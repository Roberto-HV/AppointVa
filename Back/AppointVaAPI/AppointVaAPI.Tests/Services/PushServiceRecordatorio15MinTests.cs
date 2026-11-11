using System.Security.Cryptography;
using AppointVaAPI.Constants;
using AppointVaAPI.Models;
using AppointVaAPI.Services;
using AppointVaAPI.Tests.Controllers;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;

namespace AppointVaAPI.Tests.Services;

/// <summary>
/// El id del job de los 15 minutos no se guarda en ninguna parte, así que un reagendado no
/// puede borrarlo: lo único que frena al job viejo es la guarda de vigencia. Era simétrica,
/// de modo que también dejaba pasar citas ya empezadas —una cita movida de las 14:00 a las
/// 13:40 conservaba el job de las 13:45, que avisaba "en 15 minutos" con la cita en curso—.
/// Estas pruebas fijan que la ventana mira solo hacia adelante.
/// </summary>
public class PushServiceRecordatorio15MinTests
{
    private const string Endpoint = "https://fcm.googleapis.com/fcm/send/prueba-15min";

    private static string B64(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] PuntoNoComprimido(ECPoint q)
    {
        var punto = new byte[65];
        punto[0] = 0x04;
        q.X!.CopyTo(punto, 1);
        q.Y!.CopyTo(punto, 33);
        return punto;
    }

    /// <summary>
    /// Cuenta los POST al servicio de push. Es la única señal de que el aviso salió: sin
    /// claves VAPID reales EnviarAsync se corta antes y la guarda dejaría de distinguirse.
    /// </summary>
    private sealed class ContadorDeEnvios : HttpMessageHandler
    {
        public int Envios { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Envios++;
            return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.Created));
        }
    }

    private static async Task<(PushService Push, Guid CitaId, ContadorDeEnvios Envios)> SembrarAsync(
        string dbNombre, DateTime inicioEnUtc)
    {
        var db = DbContextFactory.Create(dbNombre);
        var ahora = DateTime.UtcNow;
        var negocioId = Guid.NewGuid();
        var usuarioEmpleadoId = Guid.NewGuid();

        var negocio = new Negocio
        {
            Id = negocioId, Slug = $"push-15min-{negocioId.ToString("N")[..8]}", Nombre = "Negocio Push",
            // La zona es UTC para que InicioEn (hora local del negocio) sea ya el instante UTC.
            ZonaHoraria = "UTC", Activo = 1, FechaCreacion = ahora, FechaActualizacion = ahora,
        };
        var servicio = new Servicio
        {
            Id = Guid.NewGuid(), NegocioId = negocioId, Nombre = "Corte", DuracionMinutos = 30,
            Precio = 200m, Orden = 1, Activo = 1, FechaCreacion = ahora, FechaActualizacion = ahora,
        };
        var empleado = new Empleado
        {
            Id = Guid.NewGuid(), NegocioId = negocioId, Nombre = "Ana", Activo = 1,
            UsuarioId = usuarioEmpleadoId, FechaCreacion = ahora, FechaActualizacion = ahora,
        };
        var cliente = new Cliente
        {
            Id = Guid.NewGuid(), NegocioId = negocioId, NombreCompleto = "Clienta",
            Telefono = "5500000015", Email = "clienta@test.com",
            FechaCreacion = ahora, FechaActualizacion = ahora,
        };
        var cita = new Cita
        {
            Id = Guid.NewGuid(), CodigoConfirmacion = Guid.NewGuid().ToString("N")[..8].ToUpper(),
            NegocioId = negocioId, ClienteId = cliente.Id, EmpleadoId = empleado.Id, ServicioId = servicio.Id,
            Estado = EstadosCitas.Confirmada, Precio = 200m,
            InicioEn = DateTime.SpecifyKind(inicioEnUtc, DateTimeKind.Unspecified),
            FinEn = DateTime.SpecifyKind(inicioEnUtc.AddMinutes(30), DateTimeKind.Unspecified),
            FechaCreacion = ahora, FechaActualizacion = ahora,
        };

        // Claves reales: el servicio firma el JWT VAPID y cifra el payload RFC 8291 antes
        // de llegar al POST, así que con claves de relleno nunca se vería el envío.
        using var vapid = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var parametrosVapid = vapid.ExportParameters(true);
        using var receptor = ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256);
        var parametrosReceptor = receptor.ExportParameters(false);

        db.AddRange(negocio, servicio, empleado, cliente, cita);
        db.PushSuscripciones.Add(new PushSuscripcion
        {
            Id = Guid.NewGuid(), UsuarioId = usuarioEmpleadoId, Endpoint = Endpoint,
            P256dh = B64(PuntoNoComprimido(parametrosReceptor.Q)),
            Auth = B64(RandomNumberGenerator.GetBytes(16)),
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Push:VapidPublicKey"]  = B64(PuntoNoComprimido(parametrosVapid.Q)),
                ["Push:VapidPrivateKey"] = B64(parametrosVapid.D!),
            })
            .Build();

        var envios = new ContadorDeEnvios();
        var httpFactory = Substitute.For<IHttpClientFactory>();
        httpFactory.CreateClient("WebPush").Returns(_ => new HttpClient(envios));

        var push = new PushService(db, config, NullLogger<PushService>.Instance, httpFactory);
        return (push, cita.Id, envios);
    }

    [Fact]
    public async Task CitaQueEmpiezaEnQuinceMinutos_EnviaElAviso()
    {
        var (push, citaId, envios) = await SembrarAsync(
            nameof(CitaQueEmpiezaEnQuinceMinutos_EnviaElAviso), DateTime.UtcNow.AddMinutes(15));

        await push.EnviarRecordatorio15MinAsync(citaId);

        envios.Envios.Should().Be(1, "es justo el aviso para el que se agendó el job");
    }

    [Fact]
    public async Task CitaQueYaComenzo_DescartaElAviso()
    {
        // El job viejo de un reagendado que adelantó la hora: dispara cinco minutos después
        // de que la cita arrancó y anunciaría "en 15 minutos" cuando ya está en curso.
        var (push, citaId, envios) = await SembrarAsync(
            nameof(CitaQueYaComenzo_DescartaElAviso), DateTime.UtcNow.AddMinutes(-5));

        await push.EnviarRecordatorio15MinAsync(citaId);

        envios.Envios.Should().Be(0, "el aviso dice que la cita está por empezar, no que ya empezó");
    }
}
