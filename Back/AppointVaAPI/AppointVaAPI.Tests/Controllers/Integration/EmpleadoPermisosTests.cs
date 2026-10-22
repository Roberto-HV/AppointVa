using System.Net;
using System.Net.Http.Json;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>
/// B10 / decision 2 (DC-14): the server enforces the Empleado permission matrix
/// that Front/src/hooks/usePermisos.ts applies in the UI.
/// </summary>
public class EmpleadoPermisosTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public EmpleadoPermisosTests(CustomWebApplicationFactory factory) => _factory = factory;

    private sealed record Escenario(Guid NegocioId, Guid UsuarioEmpleadoId, Guid CitaId);

    /// <summary>Seeds a business with one employee linked to a user and one of their citas.</summary>
    private async Task<Escenario> SeedAsync(bool pagada = false, bool anticipoRecibido = false)
    {
        var negocioId = Guid.NewGuid();
        var usuarioId = Guid.NewGuid();
        var empleadoId = Guid.NewGuid();
        var clienteId = Guid.NewGuid();
        var servicioId = Guid.NewGuid();
        var citaId = Guid.NewGuid();

        await _factory.SeedNegocioAsync(negocioId);
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var ahora = DateTime.UtcNow;

        db.Empleados.Add(new Empleado
        {
            Id = empleadoId, NegocioId = negocioId, UsuarioId = usuarioId, Nombre = "Empleado",
            Email = $"emp-{empleadoId:N}@test.com", FechaCreacion = ahora, FechaActualizacion = ahora
        });
        db.Clientes.Add(new Cliente
        {
            Id = clienteId, NegocioId = negocioId, NombreCompleto = "Cliente Original",
            Telefono = "5550001111", FechaCreacion = ahora, FechaActualizacion = ahora
        });
        db.Servicios.Add(new Servicio
        {
            Id = servicioId, NegocioId = negocioId, Nombre = "Corte", Precio = 200m,
            DuracionMinutos = 30, FechaCreacion = ahora, FechaActualizacion = ahora
        });
        db.Citas.Add(new Cita
        {
            Id = citaId, NegocioId = negocioId, CodigoConfirmacion = "PRM001",
            ClienteId = clienteId, EmpleadoId = empleadoId, ServicioId = servicioId,
            InicioEn = ahora.AddDays(1), FinEn = ahora.AddDays(1).AddMinutes(30),
            Estado = 2, Precio = 200m,
            Pagada = pagada, MetodoPago = pagada ? "Efectivo" : null, FechaPago = pagada ? ahora : null,
            AnticipoRequerido = true, MontoAnticipo = 50m, AnticipoRecibido = anticipoRecibido,
            FechaCreacion = ahora, FechaActualizacion = ahora
        });
        await db.SaveChangesAsync();

        return new Escenario(negocioId, usuarioId, citaId);
    }

    private HttpClient ClienteEmpleado(Escenario e) =>
        _factory.CreateAuthenticatedClient(TestTokenHelper.GenerarToken("Empleado", e.NegocioId, e.UsuarioEmpleadoId));

    private HttpClient ClientePropietario(Escenario e) =>
        _factory.CreateAuthenticatedClient(TestTokenHelper.Propietario(e.NegocioId));

    // ── Exports ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ExportarCitas_Empleado_Retorna403()
    {
        var e = await SeedAsync();
        var r = await ClienteEmpleado(e).GetAsync("/api/reportes/citas/exportar");
        r.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ExportarCitas_Propietario_Retorna200()
    {
        var e = await SeedAsync();
        var r = await ClientePropietario(e).GetAsync("/api/reportes/citas/exportar");
        r.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ListarClientes_FuenteDelExport_Empleado_Retorna403()
    {
        var e = await SeedAsync();
        var r = await ClienteEmpleado(e).GetAsync("/api/clientes");
        r.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Cash closing ───────────────────────────────────────────────────────────

    [Fact]
    public async Task CierreCaja_Empleado_Retorna403EnLecturaYCierre()
    {
        var e = await SeedAsync();
        var client = ClienteEmpleado(e);
        var hoy = DateTime.UtcNow.ToString("yyyy-MM-dd");

        (await client.GetAsync($"/api/cierre-caja?fecha={hoy}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await client.PostAsJsonAsync("/api/cierre-caja", new { fecha = hoy })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Payment reversal ───────────────────────────────────────────────────────

    [Fact]
    public async Task RevertirPago_Empleado_Retorna403YNoCambiaLaCita()
    {
        var e = await SeedAsync(pagada: true);

        var r = await ClienteEmpleado(e).PatchAsJsonAsync($"/api/citas/{e.CitaId}/pago", new { Pagada = false });

        r.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.Citas.FindAsync(e.CitaId))!.Pagada.Should().BeTrue();
    }

    [Fact]
    public async Task SobrescribirPagoRegistrado_Empleado_Retorna403()
    {
        var e = await SeedAsync(pagada: true);
        var r = await ClienteEmpleado(e).PatchAsJsonAsync($"/api/citas/{e.CitaId}/pago",
            new { Pagada = true, MetodoPago = "Tarjeta", MontoCobrado = 1m });
        r.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task CobrarCitaPropia_Empleado_Retorna200()
    {
        var e = await SeedAsync();
        var r = await ClienteEmpleado(e).PatchAsJsonAsync($"/api/citas/{e.CitaId}/pago",
            new { Pagada = true, MetodoPago = "Efectivo", MontoCobrado = 200m });
        r.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task RevertirPago_Propietario_Retorna200()
    {
        var e = await SeedAsync(pagada: true);
        var r = await ClientePropietario(e).PatchAsJsonAsync($"/api/citas/{e.CitaId}/pago", new { Pagada = false });
        r.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ── Deposit annulment ──────────────────────────────────────────────────────

    [Fact]
    public async Task AnularAnticipo_Empleado_Retorna403YNoCambiaLaCita()
    {
        var e = await SeedAsync(anticipoRecibido: true);

        var r = await ClienteEmpleado(e).PatchAsJsonAsync($"/api/citas/{e.CitaId}/anticipo", new { Recibido = false });

        r.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.Citas.FindAsync(e.CitaId))!.AnticipoRecibido.Should().BeTrue();
    }

    [Fact]
    public async Task AnularAnticipo_Propietario_Retorna200()
    {
        var e = await SeedAsync(anticipoRecibido: true);
        var r = await ClientePropietario(e).PatchAsJsonAsync($"/api/citas/{e.CitaId}/anticipo", new { Recibido = false });
        r.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ── Global client edit (PATCH /citas/{id}/cliente) ────────────────────────

    [Fact]
    public async Task EditarClienteDeCita_Empleado_Retorna403YNoCambiaElCliente()
    {
        var e = await SeedAsync();

        var r = await ClienteEmpleado(e).PatchAsJsonAsync($"/api/citas/{e.CitaId}/cliente",
            new { NombreCompleto = "Nombre Cambiado", Telefono = "5550001111", Email = "" });

        r.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var cita = await db.Citas.FindAsync(e.CitaId);
        (await db.Clientes.FindAsync(cita!.ClienteId))!.NombreCompleto.Should().Be("Cliente Original");
    }

    [Fact]
    public async Task EditarClienteDeCita_Propietario_Retorna200()
    {
        var e = await SeedAsync();
        var r = await ClientePropietario(e).PatchAsJsonAsync($"/api/citas/{e.CitaId}/cliente",
            new { NombreCompleto = "Nombre Cambiado", Telefono = "5550001111", Email = "" });
        r.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task EditarClienteDeCita_PropietarioDeOtroNegocio_Retorna404()
    {
        var e = await SeedAsync();
        var ajeno = _factory.CreateAuthenticatedClient(TestTokenHelper.Propietario(Guid.NewGuid()));
        var r = await ajeno.PatchAsJsonAsync($"/api/citas/{e.CitaId}/cliente",
            new { NombreCompleto = "Intruso", Telefono = "5550001111", Email = "" });
        r.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
