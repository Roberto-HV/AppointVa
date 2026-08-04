using System.Net;
using System.Net.Http.Json;
using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Citas;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class CitasPagoMixtoTests : IntegrationTestBase
{
    public CitasPagoMixtoTests(CustomWebApplicationFactory factory) : base(factory) { }

    private async Task<Guid> SeedCitaAsync()
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var negocio = new Negocio
        {
            Id                 = Guid.NewGuid(),
            Nombre             = "Test Pago Mixto",
            Slug               = $"test-mixto-{Guid.NewGuid().ToString("N")[..8]}",
            ZonaHoraria        = "UTC",
            Activo             = 1,
            FechaCreacion      = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        };
        db.Negocios.Add(negocio);

        var servicio = new Servicio
        {
            Id                 = Guid.NewGuid(),
            NegocioId          = negocio.Id,
            Nombre             = "Corte",
            DuracionMinutos    = 30,
            BufferMinutos      = 0,
            Precio             = 200m,
            Orden              = 1,
            Activo             = 1,
            FechaCreacion      = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        };
        db.Servicios.Add(servicio);

        var empleado = new Empleado
        {
            Id                 = Guid.NewGuid(),
            NegocioId          = negocio.Id,
            Nombre             = "Empleado Test",
            Activo             = 1,
            FechaCreacion      = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        };
        db.Empleados.Add(empleado);

        var cliente = new Cliente
        {
            Id                    = Guid.NewGuid(),
            NegocioId             = negocio.Id,
            NombreCompleto        = "Cliente Test",
            Telefono              = "1111111111",
            TotalCitas            = 0,
            CantidadInasistencias = 0,
            FechaCreacion         = DateTime.UtcNow,
            FechaActualizacion    = DateTime.UtcNow,
        };
        db.Clientes.Add(cliente);

        var cita = new Cita
        {
            Id                 = Guid.NewGuid(),
            NegocioId          = negocio.Id,
            ServicioId         = servicio.Id,
            EmpleadoId         = empleado.Id,
            ClienteId          = cliente.Id,
            InicioEn           = DateTime.UtcNow,
            FinEn              = DateTime.UtcNow.AddMinutes(30),
            Estado             = EstadosCitas.Completada,
            Precio             = 200m,
            CodigoConfirmacion = Guid.NewGuid().ToString("N")[..8].ToUpper(),
            FechaCreacion      = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        };
        db.Citas.Add(cita);
        await db.SaveChangesAsync();

        SetToken(TestTokenHelper.Propietario(negocio.Id));
        return cita.Id;
    }

    [Fact]
    public async Task MarcarPago_ConPagoMixto_PersistAmbosMetodos()
    {
        var citaId = await SeedCitaAsync();

        var dto = new MarcarPagoDto
        {
            Pagada        = true,
            MetodoPago    = "Efectivo",
            MontoCobrado  = 200m,
            MontoRecibido = 200m,
            Cambio        = 0m,
            MetodoPago2   = "Tarjeta",
            MontoPago2    = 80m,
        };

        var response = await Client.PatchAsJsonAsync($"api/citas/{citaId}/pago", dto);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<CitaDto>();
        result!.MetodoPago.Should().Be("Efectivo");
        result.MetodoPago2.Should().Be("Tarjeta");
        result.MontoPago2.Should().Be(80m);
    }

    [Fact]
    public async Task MarcarPago_MontoPago2MayorOIgual_Retorna400()
    {
        var citaId = await SeedCitaAsync();

        var dto = new MarcarPagoDto
        {
            Pagada        = true,
            MetodoPago    = "Efectivo",
            MontoCobrado  = 200m,
            MontoRecibido = 200m,
            Cambio        = 0m,
            MetodoPago2   = "Tarjeta",
            MontoPago2    = 200m  // equal to MontoCobrado — must be rejected
        };

        var response = await Client.PatchAsJsonAsync($"api/citas/{citaId}/pago", dto);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task MarcarPago_SinPago_LimpiaCamposMixtos()
    {
        var citaId = await SeedCitaAsync();

        // First mark as paid with split payment
        await Client.PatchAsJsonAsync($"api/citas/{citaId}/pago", new MarcarPagoDto
        {
            Pagada        = true,
            MetodoPago    = "Efectivo",
            MontoCobrado  = 200m,
            MontoRecibido = 200m,
            Cambio        = 0m,
            MetodoPago2   = "Tarjeta",
            MontoPago2    = 80m,
        });

        // Then unmark payment
        var response = await Client.PatchAsJsonAsync(
            $"api/citas/{citaId}/pago",
            new MarcarPagoDto { Pagada = false });
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<CitaDto>();
        result!.MetodoPago2.Should().BeNull();
        result.MontoPago2.Should().BeNull();
    }
}
