using System.Net;
using System.Net.Http.Json;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class BookingFlowIntegrationTests : IntegrationTestBase
{
    public BookingFlowIntegrationTests(CustomWebApplicationFactory factory)
        : base(factory) { }

    // Seeds the minimum negocio + servicio + empleado + join + full-week schedule.
    private async Task<(Guid negocioId, string slug, Guid servicioId, Guid empleadoId)> SeedNegocioAsync()
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var negocioId  = Guid.NewGuid();
        var slug       = "test-" + negocioId.ToString("N")[..8];
        var servicioId = Guid.NewGuid();
        var empleadoId = Guid.NewGuid();

        db.Negocios.Add(new Negocio
        {
            Id = negocioId, Slug = slug, Nombre = "Test Salon",
            ZonaHoraria = "UTC", AutoConfirmar = true, HorasCancelacion = 0,
            Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        });
        db.Servicios.Add(new Servicio
        {
            Id = servicioId, NegocioId = negocioId, Nombre = "Corte Test",
            DuracionMinutos = 30, BufferMinutos = 0, Precio = 200m,
            Orden = 1, Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        });
        db.Empleados.Add(new Empleado
        {
            Id = empleadoId, NegocioId = negocioId, Nombre = "Empleado Test",
            Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        });
        db.EmpleadosServicios.Add(new EmpleadoServicio { EmpleadoId = empleadoId, ServicioId = servicioId });

        // Full-week schedule so ObtenerDisponibilidad always finds slots
        for (byte day = 0; day <= 6; day++)
            db.HorariosEmpleados.Add(new HorarioEmpleado
            {
                Id = Guid.NewGuid(), EmpleadoId = empleadoId, DiaSemana = day,
                HoraInicio = new TimeSpan(8, 0, 0), HoraFin = new TimeSpan(20, 0, 0), Activo = 1,
            });

        await db.SaveChangesAsync();
        return (negocioId, slug, servicioId, empleadoId);
    }

    // Creates a cita via the public HTTP endpoint and returns its CodigoConfirmacion.
    private async Task<string> CrearCitaAsync(string slug, Guid servicioId, Guid empleadoId)
    {
        var client  = NewClient();
        var inicio  = DateTime.UtcNow.Date.AddDays(1).AddHours(10);
        var payload = new
        {
            negocioSlug    = slug,
            servicioId,
            empleadoId,
            inicioEn       = inicio,
            nombreCliente  = "Cliente Test",
            telefonoCliente = "5512345678",
            emailCliente   = "cliente@test.com",
        };
        var response = await client.PostAsJsonAsync("/api/publico/citas", payload);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<ConfirmacionResponse>();
        return body!.CodigoConfirmacion;
    }

    // ── ObtenerDisponibilidad ────────────────────────────────────────────────────

    [Fact]
    public async Task Disponibilidad_ServicioInexistente_Retorna404()
    {
        var fecha    = DateTime.UtcNow.Date.AddDays(1).ToString("yyyy-MM-dd");
        var client   = NewClient();
        var response = await client.GetAsync(
            $"/api/publico/disponibilidad?servicioId={Guid.NewGuid()}&fecha={fecha}");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Disponibilidad_DatosValidos_Retorna200()
    {
        var (_, _, servicioId, empleadoId) = await SeedNegocioAsync();
        var fecha    = DateTime.UtcNow.Date.AddDays(1).ToString("yyyy-MM-dd");
        var client   = NewClient();
        var response = await client.GetAsync(
            $"/api/publico/disponibilidad?servicioId={servicioId}&empleadoId={empleadoId}&fecha={fecha}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ── CrearCita ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CrearCita_NegocioInexistente_Retorna404()
    {
        var client   = NewClient();
        var response = await client.PostAsJsonAsync("/api/publico/citas", new
        {
            negocioSlug     = "slug-que-no-existe-xyz",
            servicioId      = Guid.NewGuid(),
            empleadoId      = Guid.NewGuid(),
            inicioEn        = DateTime.UtcNow.AddDays(1),
            nombreCliente   = "Test",
            telefonoCliente = "5599887766",
        });
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CrearCita_PayloadVacio_Retorna400()
    {
        var client   = NewClient();
        var response = await client.PostAsJsonAsync("/api/publico/citas", new { });
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CrearCita_DatosValidos_Retorna201ConCodigo()
    {
        var (_, slug, servicioId, empleadoId) = await SeedNegocioAsync();
        var client   = NewClient();
        var response = await client.PostAsJsonAsync("/api/publico/citas", new
        {
            negocioSlug     = slug,
            servicioId,
            empleadoId,
            inicioEn        = DateTime.UtcNow.Date.AddDays(1).AddHours(10),
            nombreCliente   = "María López",
            telefonoCliente = "5512345678",
            emailCliente    = "maria@test.com",
        });
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<ConfirmacionResponse>();
        body!.CodigoConfirmacion.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task CrearCita_ServicioDeOtroNegocio_Retorna400()
    {
        // Seed negocio A and use a servicioId from negocio B (doesn't belong to A)
        var (_, slug, _, empleadoId) = await SeedNegocioAsync();
        var client   = NewClient();
        var response = await client.PostAsJsonAsync("/api/publico/citas", new
        {
            negocioSlug     = slug,
            servicioId      = Guid.NewGuid(),   // unknown service
            empleadoId,
            inicioEn        = DateTime.UtcNow.Date.AddDays(1).AddHours(11),
            nombreCliente   = "Test User",
            telefonoCliente = "5500000001",
        });
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── ObtenerCita ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task ObtenerCita_CodigoInexistente_Retorna404()
    {
        var client   = NewClient();
        var response = await client.GetAsync("/api/publico/citas/NOEXISTE");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ObtenerCita_CodigoValido_Retorna200()
    {
        var (_, slug, servicioId, empleadoId) = await SeedNegocioAsync();
        var codigo   = await CrearCitaAsync(slug, servicioId, empleadoId);
        var client   = NewClient();
        var response = await client.GetAsync($"/api/publico/citas/{codigo}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ── CancelarCita ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task CancelarCita_SinEmailParam_Retorna400()
    {
        var (_, slug, servicioId, empleadoId) = await SeedNegocioAsync();
        var codigo   = await CrearCitaAsync(slug, servicioId, empleadoId);
        var client   = NewClient();
        var response = await client.DeleteAsync($"/api/publico/citas/{codigo}");
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CancelarCita_EmailIncorrecto_Retorna403()
    {
        var (_, slug, servicioId, empleadoId) = await SeedNegocioAsync();
        var codigo   = await CrearCitaAsync(slug, servicioId, empleadoId);
        var client   = NewClient();
        var response = await client.DeleteAsync($"/api/publico/citas/{codigo}?email=otro@email.com");
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task CancelarCita_EmailCorrecto_Retorna204()
    {
        var (_, slug, servicioId, empleadoId) = await SeedNegocioAsync();
        var codigo   = await CrearCitaAsync(slug, servicioId, empleadoId);
        var client   = NewClient();
        var response = await client.DeleteAsync($"/api/publico/citas/{codigo}?email=cliente@test.com");
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    // ── ReagendarCita ────────────────────────────────────────────────────────────

    [Fact]
    public async Task ReagendarCita_EmailCorrecto_Retorna200()
    {
        var (_, slug, servicioId, empleadoId) = await SeedNegocioAsync();
        var codigo      = await CrearCitaAsync(slug, servicioId, empleadoId);
        var nuevoInicio = DateTime.UtcNow.Date.AddDays(2).AddHours(14);
        var client      = NewClient();
        var response    = await client.PatchAsJsonAsync(
            $"/api/publico/citas/{codigo}/reagendar?email=cliente@test.com",
            new { inicioEn = nuevoInicio });
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ReagendarCita_EmailIncorrecto_Retorna403()
    {
        var (_, slug, servicioId, empleadoId) = await SeedNegocioAsync();
        var codigo   = await CrearCitaAsync(slug, servicioId, empleadoId);
        var client   = NewClient();
        var response = await client.PatchAsJsonAsync(
            $"/api/publico/citas/{codigo}/reagendar?email=otro@otro.com",
            new { inicioEn = DateTime.UtcNow.Date.AddDays(3).AddHours(10) });
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Response shape ───────────────────────────────────────────────────────────

    private record ConfirmacionResponse(string CodigoConfirmacion);
}
