using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>
/// B14 (list with inactive coupons, reactivation) and B16 (PUT for coupons).
/// </summary>
public class DescuentosEdicionReactivacionTests : IntegrationTestBase
{
    public DescuentosEdicionReactivacionTests(CustomWebApplicationFactory factory) : base(factory) { }

    private async Task<Guid> SeedNegocioAsync()
    {
        var id = Guid.NewGuid();
        await Factory.SeedNegocioAsync(id);
        return id;
    }

    private async Task<Guid> SeedDescuentoAsync(Guid negocioId, string codigo, bool activo = true,
        int usoActual = 0, int? usoMaximo = null)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var d = new Descuento
        {
            Id = Guid.NewGuid(), NegocioId = negocioId, Codigo = codigo, Tipo = "Porcentaje", Valor = 10m,
            UsoActual = usoActual, UsoMaximo = usoMaximo, Activo = activo, FechaCreacion = DateTime.UtcNow,
        };
        db.Descuentos.Add(d);
        await db.SaveChangesAsync();
        return d.Id;
    }

    private async Task<Descuento> LeerAsync(Guid id)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.Descuentos.AsNoTracking().FirstAsync(d => d.Id == id);
    }

    private HttpClient Propietario(Guid negocioId) => NewClient(TestTokenHelper.Propietario(negocioId));

    private static object Cuerpo(string codigo = "PROMO", string tipo = "Porcentaje", decimal valor = 20m,
        int? usoMaximo = null) => new { codigo, tipo, valor, usoMaximo, descripcion = "Editado" };

    // ── B14: list ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Listar_PorDefectoSoloActivos_ConIncluirInactivosTodos()
    {
        var negocio = await SeedNegocioAsync();
        await SeedDescuentoAsync(negocio, "ACTIVO");
        await SeedDescuentoAsync(negocio, "BAJA", activo: false);
        var cliente = Propietario(negocio);

        var activos = await cliente.GetFromJsonAsync<JsonElement>("/api/descuentos");
        var todos = await cliente.GetFromJsonAsync<JsonElement>("/api/descuentos?incluirInactivos=true");

        activos.EnumerateArray().Select(d => d.GetProperty("codigo").GetString()).Should().Equal("ACTIVO");
        todos.EnumerateArray().Select(d => d.GetProperty("codigo").GetString())
            .Should().BeEquivalentTo(["ACTIVO", "BAJA"]);
    }

    [Fact]
    public async Task Listar_ConIncluirInactivos_NoMuestraOtroNegocio()
    {
        var negocio = await SeedNegocioAsync();
        var otro = await SeedNegocioAsync();
        await SeedDescuentoAsync(otro, "AJENO", activo: false);

        var lista = await Propietario(negocio).GetFromJsonAsync<JsonElement>("/api/descuentos?incluirInactivos=true");

        lista.EnumerateArray().Should().BeEmpty();
    }

    // ── B14: reactivate ──────────────────────────────────────────────────────

    [Fact]
    public async Task Reactivar_ActivaElCupon()
    {
        var negocio = await SeedNegocioAsync();
        var id = await SeedDescuentoAsync(negocio, "VUELVE", activo: false);

        var r = await Propietario(negocio).PatchAsync($"/api/descuentos/{id}/reactivar", null);

        r.StatusCode.Should().Be(HttpStatusCode.OK);
        (await LeerAsync(id)).Activo.Should().BeTrue();
    }

    [Fact]
    public async Task Reactivar_ConOtroActivoMismoCodigo_Retorna409()
    {
        var negocio = await SeedNegocioAsync();
        await SeedDescuentoAsync(negocio, "DUPLI");
        var id = await SeedDescuentoAsync(negocio, "DUPLI", activo: false);

        var r = await Propietario(negocio).PatchAsync($"/api/descuentos/{id}/reactivar", null);

        r.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await LeerAsync(id)).Activo.Should().BeFalse();
    }

    [Fact]
    public async Task Reactivar_DeOtroNegocio_Retorna404()
    {
        var negocio = await SeedNegocioAsync();
        var otro = await SeedNegocioAsync();
        var id = await SeedDescuentoAsync(otro, "AJENO", activo: false);

        (await Propietario(negocio).PatchAsync($"/api/descuentos/{id}/reactivar", null)).StatusCode
            .Should().Be(HttpStatusCode.NotFound);
        (await LeerAsync(id)).Activo.Should().BeFalse();
    }

    [Fact]
    public async Task ReactivarYEditar_ConEmpleado_Retorna403()
    {
        var negocio = await SeedNegocioAsync();
        var id = await SeedDescuentoAsync(negocio, "EMPL", activo: false);
        var empleado = NewClient(TestTokenHelper.Empleado(negocio));

        (await empleado.PatchAsync($"/api/descuentos/{id}/reactivar", null)).StatusCode
            .Should().Be(HttpStatusCode.Forbidden);
        (await empleado.PutAsJsonAsync($"/api/descuentos/{id}", Cuerpo())).StatusCode
            .Should().Be(HttpStatusCode.Forbidden);
    }

    // ── B16: edit ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Editar_ActualizaCamposYConservaUsos()
    {
        var negocio = await SeedNegocioAsync();
        var id = await SeedDescuentoAsync(negocio, "VIEJO", usoActual: 3, usoMaximo: 10);

        var r = await Propietario(negocio).PutAsJsonAsync($"/api/descuentos/{id}",
            Cuerpo(codigo: " nuevo ", tipo: "MontoFijo", valor: 50m, usoMaximo: 5));

        r.StatusCode.Should().Be(HttpStatusCode.OK);
        var d = await LeerAsync(id);
        d.Codigo.Should().Be("NUEVO");
        d.Tipo.Should().Be("MontoFijo");
        d.Valor.Should().Be(50m);
        d.UsoMaximo.Should().Be(5);
        d.UsoActual.Should().Be(3);
        d.Descripcion.Should().Be("Editado");
    }

    [Fact]
    public async Task Editar_LimiteMenorALosUsos_Retorna400()
    {
        var negocio = await SeedNegocioAsync();
        var id = await SeedDescuentoAsync(negocio, "USADO", usoActual: 4);

        var r = await Propietario(negocio).PutAsJsonAsync($"/api/descuentos/{id}", Cuerpo(codigo: "USADO", usoMaximo: 3));

        r.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await LeerAsync(id)).UsoMaximo.Should().BeNull();
    }

    [Theory]
    [InlineData("Porcentaje", 150)]
    [InlineData("Otro", 10)]
    public async Task Editar_ValoresInvalidos_Retorna400(string tipo, decimal valor)
    {
        var negocio = await SeedNegocioAsync();
        var id = await SeedDescuentoAsync(negocio, "REGLAS");

        var r = await Propietario(negocio).PutAsJsonAsync($"/api/descuentos/{id}", Cuerpo(codigo: "REGLAS", tipo: tipo, valor: valor));

        r.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await LeerAsync(id)).Valor.Should().Be(10m);
    }

    [Fact]
    public async Task Crear_PorcentajeMayorA100_Retorna400()
    {
        var negocio = await SeedNegocioAsync();

        var r = await Propietario(negocio).PostAsJsonAsync("/api/descuentos", Cuerpo(codigo: "MUCHO", valor: 150m));

        r.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Editar_CodigoDeOtroActivo_Retorna400()
    {
        var negocio = await SeedNegocioAsync();
        await SeedDescuentoAsync(negocio, "OCUPADO");
        var id = await SeedDescuentoAsync(negocio, "LIBRE");

        var r = await Propietario(negocio).PutAsJsonAsync($"/api/descuentos/{id}", Cuerpo(codigo: "ocupado"));

        r.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await LeerAsync(id)).Codigo.Should().Be("LIBRE");
    }

    [Fact]
    public async Task Editar_MismoCodigo_NoChocaConsigoMismo()
    {
        var negocio = await SeedNegocioAsync();
        var id = await SeedDescuentoAsync(negocio, "PROPIO");

        var r = await Propietario(negocio).PutAsJsonAsync($"/api/descuentos/{id}", Cuerpo(codigo: "PROPIO", valor: 30m));

        r.StatusCode.Should().Be(HttpStatusCode.OK);
        (await LeerAsync(id)).Valor.Should().Be(30m);
    }

    [Fact]
    public async Task Editar_DeOtroNegocio_Retorna404()
    {
        var negocio = await SeedNegocioAsync();
        var otro = await SeedNegocioAsync();
        var id = await SeedDescuentoAsync(otro, "AJENO");

        (await Propietario(negocio).PutAsJsonAsync($"/api/descuentos/{id}", Cuerpo(codigo: "AJENO", valor: 99m)))
            .StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await LeerAsync(id)).Valor.Should().Be(10m);
    }
}
