using System.Net.Http.Json;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Publico;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class PublicoAnticipoTests : IntegrationTestBase
{
    public PublicoAnticipoTests(CustomWebApplicationFactory factory) : base(factory) { }

    private async Task<(Guid negocioId, string slug, Guid servicioId, Guid empleadoId)> SeedNegocioConAnticipoAsync(
        bool requiereAnticipo, int porcentaje)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var negocioId  = Guid.NewGuid();
        var slug       = "anticipo-" + negocioId.ToString("N")[..8];
        var servicioId = Guid.NewGuid();
        var empleadoId = Guid.NewGuid();

        db.Negocios.Add(new Negocio
        {
            Id = negocioId, Slug = slug, Nombre = "Salon Anticipo Test",
            ZonaHoraria = "UTC", AutoConfirmar = true, HorasCancelacion = 0,
            Activo = 1,
            RequiereAnticipo = requiereAnticipo,
            PorcentajeAnticipo = porcentaje,
            PoliticaCancelacionAnticipo = "Sin reembolso.",
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        });
        db.Servicios.Add(new Servicio
        {
            Id = servicioId, NegocioId = negocioId, Nombre = "Corte",
            DuracionMinutos = 30, BufferMinutos = 0, Precio = 200m,
            Orden = 1, Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        });
        db.Empleados.Add(new Empleado
        {
            Id = empleadoId, NegocioId = negocioId, Nombre = "Empleado",
            Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        });
        db.EmpleadosServicios.Add(new EmpleadoServicio { EmpleadoId = empleadoId, ServicioId = servicioId });
        for (byte day = 0; day <= 6; day++)
            db.HorariosEmpleados.Add(new HorarioEmpleado
            {
                Id = Guid.NewGuid(), EmpleadoId = empleadoId, DiaSemana = day,
                HoraInicio = new TimeSpan(8, 0, 0), HoraFin = new TimeSpan(20, 0, 0), Activo = 1,
            });

        await db.SaveChangesAsync();
        return (negocioId, slug, servicioId, empleadoId);
    }

    [Fact]
    public async Task ObtenerNegocio_DevuelveAnticipoCampos()
    {
        // Arrange
        var (_, slug, _, _) = await SeedNegocioConAnticipoAsync(true, 25);
        ClearToken();

        // Act
        var response = await Client.GetAsync($"/api/publico/negocios/{slug}");

        // Assert
        response.IsSuccessStatusCode.Should().BeTrue();
        var body = await response.Content.ReadFromJsonAsync<NegocioPublicoDto>();
        body.Should().NotBeNull();
        body!.PorcentajeAnticipo.Should().Be(25);
        body.PoliticaCancelacionAnticipo.Should().Be("Sin reembolso.");
    }

    [Fact]
    public async Task CrearCita_NegocioConAnticipo_SnapshotCorrecto()
    {
        // Arrange — negocio with 25% anticipo, servicio price 200 → expected MontoAnticipo = 50
        var (_, slug, servicioId, empleadoId) = await SeedNegocioConAnticipoAsync(true, 25);
        var client = NewClient();

        var inicio = DateTime.UtcNow.Date.AddDays(1).AddHours(10);
        var payload = new
        {
            negocioSlug    = slug,
            servicioId,
            empleadoId,
            inicioEn       = inicio,
            nombreCliente  = "Cliente Test",
            telefonoCliente = "5512345678",
            emailCliente   = "test@test.com",
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/publico/citas", payload);

        // Assert
        response.IsSuccessStatusCode.Should().BeTrue();
        var confirmacion = await response.Content.ReadFromJsonAsync<ConfirmacionCitaDto>();
        confirmacion.Should().NotBeNull();
        confirmacion!.RequiereAnticipo.Should().BeTrue();
        confirmacion.MontoAnticipo.Should().Be(50m); // Math.Round(200 * 25 / 100, 2)
    }

    [Fact]
    public async Task CrearCita_NegocioSinAnticipo_SnapshotFalse()
    {
        // Arrange
        var (_, slug, servicioId, empleadoId) = await SeedNegocioConAnticipoAsync(false, 0);
        var client = NewClient();

        var inicio = DateTime.UtcNow.Date.AddDays(1).AddHours(10);
        var payload = new
        {
            negocioSlug    = slug,
            servicioId,
            empleadoId,
            inicioEn       = inicio,
            nombreCliente  = "Cliente Test",
            telefonoCliente = "5512345678",
            emailCliente   = "test2@test.com",
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/publico/citas", payload);

        // Assert
        response.IsSuccessStatusCode.Should().BeTrue();
        var confirmacion = await response.Content.ReadFromJsonAsync<ConfirmacionCitaDto>();
        confirmacion.Should().NotBeNull();
        confirmacion!.RequiereAnticipo.Should().BeFalse();
        confirmacion.MontoAnticipo.Should().BeNull();
    }

    [Fact]
    public async Task ObtenerCita_DevuelveMontoAnticipoDelSnapshot()
    {
        // Arrange — negocio with 25% anticipo, servicio 200 -> montoAnticipo should be 50
        var (_, slug, servicioId, empleadoId) = await SeedNegocioConAnticipoAsync(true, 25);
        var client = NewClient();
        ClearToken();

        var inicio = DateTime.UtcNow.Date.AddDays(1).AddHours(10);
        var payload = new
        {
            negocioSlug = slug,
            servicioId,
            empleadoId,
            inicioEn = inicio,
            nombreCliente = "Cliente Test",
            telefonoCliente = "5512345678",
            emailCliente = "obtener@test.com",
        };

        // Create the cita first to get its CodigoConfirmacion
        var createResponse = await client.PostAsJsonAsync("/api/publico/citas", payload);
        createResponse.EnsureSuccessStatusCode();
        var created = await createResponse.Content.ReadFromJsonAsync<ConfirmacionCitaDto>();

        // Act — GET the same cita by codigo
        var getResponse = await client.GetAsync($"/api/publico/citas/{created!.CodigoConfirmacion}");

        // Assert
        getResponse.IsSuccessStatusCode.Should().BeTrue();
        var dto = await getResponse.Content.ReadFromJsonAsync<ConfirmacionCitaDto>();
        dto.Should().NotBeNull();
        dto!.RequiereAnticipo.Should().BeTrue();
        dto.MontoAnticipo.Should().Be(50m);
    }
}
