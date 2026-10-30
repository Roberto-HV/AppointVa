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
/// G3: staff pushes about an appointment still go out when its client was deleted.
/// Before, the push jobs loaded the appointment with Include(c => c.Cliente), an INNER
/// JOIN through the Cliente soft-delete filter, found nothing and sent nothing.
/// </summary>
public class PushServiceClienteEliminadoTests
{
    private static async Task<(PushService push, Guid citaId)> SembrarAsync(string dbNombre, bool clienteEliminado)
    {
        var db = DbContextFactory.Create(dbNombre);
        var negocioId = Guid.NewGuid();
        var negocio = new Negocio
        {
            Id = negocioId, Slug = $"push-g3-{negocioId.ToString("N")[..8]}", Nombre = "Negocio Push",
            ZonaHoraria = "UTC", Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        };
        var servicio = new Servicio
        {
            Id = Guid.NewGuid(), NegocioId = negocioId, Nombre = "Corte", DuracionMinutos = 30,
            Precio = 200m, Orden = 1, Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        };
        var empleado = new Empleado
        {
            Id = Guid.NewGuid(), NegocioId = negocioId, Nombre = "Ana", Activo = 1,
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        };
        var cliente = new Cliente
        {
            Id = Guid.NewGuid(), NegocioId = negocioId, NombreCompleto = "Cliente Borrado",
            Telefono = "5500000002", Email = "borrado@test.com",
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
            FechaEliminacion = clienteEliminado ? DateTime.UtcNow : null,
        };
        var cita = new Cita
        {
            Id = Guid.NewGuid(), CodigoConfirmacion = Guid.NewGuid().ToString("N")[..8].ToUpper(),
            NegocioId = negocioId, ClienteId = cliente.Id, EmpleadoId = empleado.Id, ServicioId = servicio.Id,
            Estado = EstadosCitas.Confirmada, Precio = 200m,
            InicioEn = DateTime.UtcNow.AddDays(1), FinEn = DateTime.UtcNow.AddDays(1).AddMinutes(30),
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        };
        db.AddRange(negocio, servicio, empleado, cliente, cita);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var push = new PushService(db, new ConfigurationBuilder().Build(),
            NullLogger<PushService>.Instance, Substitute.For<IHttpClientFactory>());
        return (push, cita.Id);
    }

    [Fact]
    public async Task CargarCita_ClienteEliminado_EncuentraLaCitaSinCliente()
    {
        var (push, citaId) = await SembrarAsync(nameof(CargarCita_ClienteEliminado_EncuentraLaCitaSinCliente), true);

        var cita = await push.CargarCitaAsync(citaId);

        cita.Should().NotBeNull("staff must still be notified about the appointment");
        cita!.Cliente.Should().BeNull();
        cita.Servicio.Should().NotBeNull();
        cita.Empleado.Should().NotBeNull();
    }

    [Fact]
    public async Task Payload_ClienteEliminado_DiceClienteEliminadoSinContacto()
    {
        var (push, citaId) = await SembrarAsync(nameof(Payload_ClienteEliminado_DiceClienteEliminadoSinContacto), true);
        var cita = (await push.CargarCitaAsync(citaId))!;

        var payload = PushService.BuildPayloadNuevaCita(cita, null, null);
        var calendario = Uri.UnescapeDataString(PushService.BuildGoogleCalendarUrl(cita));

        payload.Should().Contain("Cliente eliminado").And.NotContain("Cliente Borrado");
        calendario.Should().Contain("Cliente eliminado")
            .And.NotContain("Cliente Borrado").And.NotContain("5500000002");
    }

    [Fact]
    public async Task CargarCita_ClienteVivo_TraeSuNombre()
    {
        var (push, citaId) = await SembrarAsync(nameof(CargarCita_ClienteVivo_TraeSuNombre), false);

        var cita = (await push.CargarCitaAsync(citaId))!;

        cita.Cliente!.NombreCompleto.Should().Be("Cliente Borrado");
        PushService.BuildPayloadNuevaCita(cita, null, null).Should().Contain("Cliente Borrado");
    }
}
