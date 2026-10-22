using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>
/// B13 (decision 7, OM-17): employee deactivation/reactivation and the count of
/// future open appointments per employee or service.
/// </summary>
public class EmpleadosDesactivarYCitasFuturasTests : IntegrationTestBase
{
    public EmpleadosDesactivarYCitasFuturasTests(CustomWebApplicationFactory factory) : base(factory) { }

    private sealed record Semilla(Guid NegocioId, string Slug, Guid EmpleadoId, Guid ServicioId);

    /// <param name="citas">Each cita: days from now and its estado.</param>
    private async Task<Semilla> SeedAsync(int? maxEmpleados = null, params (int Dias, byte Estado)[] citas)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var ahora = DateTime.UtcNow;

        Plan? plan = null;
        if (maxEmpleados.HasValue)
        {
            plan = new Plan
            {
                Id = Guid.NewGuid(), Nombre = $"Plan {Guid.NewGuid():N}", MaxEmpleados = maxEmpleados.Value,
                MaxCitasMes = 0, Activo = 1, FechaCreacion = ahora,
            };
            db.Planes.Add(plan);
        }

        var negocio = new Negocio
        {
            Id = Guid.NewGuid(), Nombre = "Negocio B13", Slug = $"b13-{Guid.NewGuid().ToString("N")[..8]}",
            ZonaHoraria = "UTC", Activo = 1, PlanId = plan?.Id, FechaCreacion = ahora, FechaActualizacion = ahora,
        };
        var servicio = new Servicio
        {
            Id = Guid.NewGuid(), NegocioId = negocio.Id, Nombre = "Corte", DuracionMinutos = 30, Precio = 200m,
            Orden = 1, Activo = 1, FechaCreacion = ahora, FechaActualizacion = ahora,
        };
        var empleado = new Empleado
        {
            Id = Guid.NewGuid(), NegocioId = negocio.Id, Nombre = "Ana", Activo = 1,
            FechaCreacion = ahora, FechaActualizacion = ahora,
        };
        var cliente = new Cliente
        {
            Id = Guid.NewGuid(), NegocioId = negocio.Id, NombreCompleto = "Cliente", Telefono = "5550000000",
            FechaCreacion = ahora, FechaActualizacion = ahora,
        };
        db.Negocios.Add(negocio);
        db.Servicios.Add(servicio);
        db.Empleados.Add(empleado);
        db.EmpleadosServicios.Add(new EmpleadoServicio { EmpleadoId = empleado.Id, ServicioId = servicio.Id });
        db.Clientes.Add(cliente);

        foreach (var (dias, estado) in citas)
        {
            var inicio = ahora.AddDays(dias);
            db.Citas.Add(new Cita
            {
                Id = Guid.NewGuid(), NegocioId = negocio.Id, ServicioId = servicio.Id, EmpleadoId = empleado.Id,
                ClienteId = cliente.Id, InicioEn = inicio, FinEn = inicio.AddMinutes(30), Estado = estado,
                Precio = 200m, CodigoConfirmacion = Guid.NewGuid().ToString("N")[..8].ToUpper(),
                FechaCreacion = ahora, FechaActualizacion = ahora,
            });
        }

        await db.SaveChangesAsync();
        return new Semilla(negocio.Id, negocio.Slug, empleado.Id, servicio.Id);
    }

    private HttpClient Propietario(Semilla s) => NewClient(TestTokenHelper.Propietario(s.NegocioId));
    private HttpClient Empleado(Semilla s) => NewClient(TestTokenHelper.Empleado(s.NegocioId));

    private static async Task<int> TotalAsync(HttpResponseMessage r)
    {
        var json = await r.Content.ReadFromJsonAsync<JsonElement>();
        return json.GetProperty("total").GetInt32();
    }

    private async Task<int> ActivoEnDbAsync(Guid empleadoId)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return (await db.Empleados.AsNoTracking().FirstAsync(e => e.Id == empleadoId)).Activo;
    }

    // ── Count ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CitasFuturas_CuentaSoloPendientesYConfirmadasDesdeHoy()
    {
        var s = await SeedAsync(null,
            (1, EstadosCitas.Pendiente), (2, EstadosCitas.Confirmada), (3, EstadosCitas.Cancelada),
            (4, EstadosCitas.Completada), (-3, EstadosCitas.Confirmada));

        var porEmpleado = await Propietario(s).GetAsync($"/api/empleados/{s.EmpleadoId}/citas-futuras");
        var porServicio = await Propietario(s).GetAsync($"/api/servicios/{s.ServicioId}/citas-futuras");

        porEmpleado.StatusCode.Should().Be(HttpStatusCode.OK);
        (await TotalAsync(porEmpleado)).Should().Be(2);
        porServicio.StatusCode.Should().Be(HttpStatusCode.OK);
        (await TotalAsync(porServicio)).Should().Be(2);
    }

    [Fact]
    public async Task CitasFuturas_ConEmpleado_Retorna403()
    {
        var s = await SeedAsync();

        (await Empleado(s).GetAsync($"/api/empleados/{s.EmpleadoId}/citas-futuras")).StatusCode
            .Should().Be(HttpStatusCode.Forbidden);
        (await Empleado(s).GetAsync($"/api/servicios/{s.ServicioId}/citas-futuras")).StatusCode
            .Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task CitasFuturas_DeOtroNegocio_Retorna404()
    {
        var s = await SeedAsync(null, (1, EstadosCitas.Pendiente));
        var otro = await SeedAsync();

        (await Propietario(otro).GetAsync($"/api/empleados/{s.EmpleadoId}/citas-futuras")).StatusCode
            .Should().Be(HttpStatusCode.NotFound);
        (await Propietario(otro).GetAsync($"/api/servicios/{s.ServicioId}/citas-futuras")).StatusCode
            .Should().Be(HttpStatusCode.NotFound);
    }

    // ── Delete guard ──────────────────────────────────────────────────────────

    [Fact]
    public async Task Eliminar_ConCitasFuturas_Retorna409YNoElimina()
    {
        var s = await SeedAsync(null, (1, EstadosCitas.Confirmada));

        (await Propietario(s).DeleteAsync($"/api/empleados/{s.EmpleadoId}")).StatusCode
            .Should().Be(HttpStatusCode.Conflict);
        (await Propietario(s).DeleteAsync($"/api/servicios/{s.ServicioId}")).StatusCode
            .Should().Be(HttpStatusCode.Conflict);
        (await ActivoEnDbAsync(s.EmpleadoId)).Should().Be(1);
    }

    [Fact]
    public async Task Eliminar_SinCitasFuturas_Retorna204()
    {
        var s = await SeedAsync(null, (-2, EstadosCitas.Confirmada), (1, EstadosCitas.Cancelada));

        (await Propietario(s).DeleteAsync($"/api/empleados/{s.EmpleadoId}")).StatusCode
            .Should().Be(HttpStatusCode.NoContent);
    }

    // ── Deactivate / reactivate ───────────────────────────────────────────────

    [Fact]
    public async Task Desactivar_DejaCitasIntactasYLoSacaDeReservasPublicas()
    {
        var s = await SeedAsync(null, (1, EstadosCitas.Confirmada));
        var cliente = Propietario(s);

        var r = await cliente.PatchAsync($"/api/empleados/{s.EmpleadoId}/desactivar", null);

        r.StatusCode.Should().Be(HttpStatusCode.OK);
        (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("activo").GetBoolean().Should().BeFalse();
        (await ActivoEnDbAsync(s.EmpleadoId)).Should().Be(0);

        // Existing appointment untouched.
        (await TotalAsync(await cliente.GetAsync($"/api/empleados/{s.EmpleadoId}/citas-futuras"))).Should().Be(1);

        // Still listed for the owner with incluirInactivos, hidden otherwise.
        var activos = await (await cliente.GetAsync("/api/empleados")).Content.ReadFromJsonAsync<JsonElement>();
        activos.EnumerateArray().Should().BeEmpty();
        var todos = await (await cliente.GetAsync("/api/empleados?incluirInactivos=true")).Content.ReadFromJsonAsync<JsonElement>();
        todos.EnumerateArray().Should().ContainSingle();

        // Not shown on the public booking page.
        ClearToken();
        var publico = await Client.GetFromJsonAsync<JsonElement>($"/api/publico/negocios/{s.Slug}");
        publico.GetProperty("empleados").EnumerateArray().Should().BeEmpty();
    }

    [Fact]
    public async Task Desactivar_ImpideCrearCitaDesdeElPanel()
    {
        var s = await SeedAsync();
        var cliente = Propietario(s);
        await cliente.PatchAsync($"/api/empleados/{s.EmpleadoId}/desactivar", null);

        var r = await cliente.PostAsJsonAsync("/api/citas", new
        {
            empleadoId = s.EmpleadoId,
            servicioId = s.ServicioId,
            inicioEn = DateTime.UtcNow.Date.AddDays(2).AddHours(10),
            nombreCliente = "Nuevo",
            telefonoCliente = "5551112222",
        });

        r.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await r.Content.ReadAsStringAsync()).Should().Contain("Empleado no v");
    }

    [Fact]
    public async Task Reactivar_VuelveAActivo()
    {
        var s = await SeedAsync();
        var cliente = Propietario(s);
        await cliente.PatchAsync($"/api/empleados/{s.EmpleadoId}/desactivar", null);

        var r = await cliente.PatchAsync($"/api/empleados/{s.EmpleadoId}/reactivar", null);

        r.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ActivoEnDbAsync(s.EmpleadoId)).Should().Be(1);
    }

    [Fact]
    public async Task Reactivar_RespetaLimiteDelPlan()
    {
        var s = await SeedAsync(maxEmpleados: 1);
        var cliente = Propietario(s);
        await cliente.PatchAsync($"/api/empleados/{s.EmpleadoId}/desactivar", null);
        // The freed seat is taken by a new employee.
        (await cliente.PostAsJsonAsync("/api/empleados", new { nombre = "Beto", servicioIds = Array.Empty<Guid>() }))
            .StatusCode.Should().Be(HttpStatusCode.Created);

        var r = await cliente.PatchAsync($"/api/empleados/{s.EmpleadoId}/reactivar", null);

        r.StatusCode.Should().Be((HttpStatusCode)402);
        (await ActivoEnDbAsync(s.EmpleadoId)).Should().Be(0);
    }

    [Fact]
    public async Task DesactivarYReactivar_ConEmpleado_Retorna403()
    {
        var s = await SeedAsync();

        (await Empleado(s).PatchAsync($"/api/empleados/{s.EmpleadoId}/desactivar", null)).StatusCode
            .Should().Be(HttpStatusCode.Forbidden);
        (await Empleado(s).PatchAsync($"/api/empleados/{s.EmpleadoId}/reactivar", null)).StatusCode
            .Should().Be(HttpStatusCode.Forbidden);
        (await ActivoEnDbAsync(s.EmpleadoId)).Should().Be(1);
    }

    [Fact]
    public async Task Desactivar_DeOtroNegocio_Retorna404YNoCambia()
    {
        var s = await SeedAsync();
        var otro = await SeedAsync();

        (await Propietario(otro).PatchAsync($"/api/empleados/{s.EmpleadoId}/desactivar", null)).StatusCode
            .Should().Be(HttpStatusCode.NotFound);
        (await Propietario(otro).PatchAsync($"/api/empleados/{s.EmpleadoId}/reactivar", null)).StatusCode
            .Should().Be(HttpStatusCode.NotFound);
        (await ActivoEnDbAsync(s.EmpleadoId)).Should().Be(1);
    }

    [Fact]
    public async Task Desactivar_SinToken_Retorna401()
    {
        var s = await SeedAsync();
        ClearToken();

        (await Client.PatchAsync($"/api/empleados/{s.EmpleadoId}/desactivar", null)).StatusCode
            .Should().Be(HttpStatusCode.Unauthorized);
    }
}
