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
/// G3: Cita.Cliente is a required navigation and Cliente has a soft-delete query filter,
/// so every Include / projection / Where through c.Cliente was an INNER JOIN that silently
/// dropped the appointments of a deleted client. The panel must show them (as "Cliente
/// eliminado", without contact data); the public link by code must not.
/// </summary>
public class CitasClienteEliminadoTests : IntegrationTestBase
{
    private const string NombreBorrado = "Cliente Borrado";
    private const string TelefonoBorrado = "5500000077";
    private const string EmailBorrado = "borrado-g3@test.com";

    public CitasClienteEliminadoTests(CustomWebApplicationFactory factory) : base(factory) { }

    private sealed record Escenario(Guid NegocioId, string Slug, Guid CitaId, string Codigo, Guid CitaPagadaId);

    /// <summary>
    /// A business with one deleted client who has an upcoming confirmed appointment and a
    /// paid one, plus a live client with one upcoming appointment.
    /// </summary>
    private async Task<Escenario> SembrarAsync()
    {
        var negocioId = Guid.NewGuid();
        await Factory.SeedNegocioAsync(negocioId);

        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var slug = (await db.Negocios.SingleAsync(n => n.Id == negocioId)).Slug;

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
        var borrado = new Cliente
        {
            Id = Guid.NewGuid(), NegocioId = negocioId, NombreCompleto = NombreBorrado,
            Telefono = TelefonoBorrado, Email = EmailBorrado,
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
            FechaEliminacion = DateTime.UtcNow,
        };
        var vivo = new Cliente
        {
            Id = Guid.NewGuid(), NegocioId = negocioId, NombreCompleto = "Cliente Vivo",
            Telefono = "5500000078", FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        };
        var manana = DateTime.UtcNow.Date.AddDays(2).AddHours(10);
        Cita Nueva(Guid clienteId, DateTime inicio, byte estado, bool pagada = false) => new()
        {
            Id = Guid.NewGuid(), CodigoConfirmacion = Guid.NewGuid().ToString("N")[..8].ToUpper(),
            NegocioId = negocioId, ClienteId = clienteId, EmpleadoId = empleado.Id, ServicioId = servicio.Id,
            Estado = estado, Precio = 200m, InicioEn = inicio, FinEn = inicio.AddMinutes(30),
            Pagada = pagada, MetodoPago = pagada ? "efectivo" : null, FechaPago = pagada ? DateTime.UtcNow : null,
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        };
        var citaBorrado = Nueva(borrado.Id, manana, EstadosCitas.Confirmada);
        var citaPagada = Nueva(borrado.Id, DateTime.UtcNow.Date.AddDays(-1).AddHours(10), EstadosCitas.Completada, pagada: true);
        var citaVivo = Nueva(vivo.Id, manana.AddHours(1), EstadosCitas.Confirmada);

        db.AddRange(servicio, empleado, borrado, vivo, citaBorrado, citaPagada, citaVivo);
        await db.SaveChangesAsync();
        return new Escenario(negocioId, slug, citaBorrado.Id, citaBorrado.CodigoConfirmacion, citaPagada.Id);
    }

    private static void SinContactoDelBorrado(string json) =>
        json.Should().NotContain(NombreBorrado).And.NotContain(TelefonoBorrado).And.NotContain(EmailBorrado);

    private static void EsClienteEliminado(JsonElement cita)
    {
        cita.GetProperty("nombreCliente").GetString().Should().Be("Cliente eliminado");
        cita.GetProperty("clienteEliminado").GetBoolean().Should().BeTrue();
        cita.GetProperty("telefonoCliente").GetString().Should().BeEmpty();
        cita.GetProperty("emailCliente").ValueKind.Should().Be(JsonValueKind.Null);
    }

    // ── Panel: list, detail, actions, Pagos, Inicio ───────────────────────────

    [Fact]
    public async Task ListaDeCitas_IncluyeLasDelClienteEliminado_SinSusDatos()
    {
        var e = await SembrarAsync();
        var client = NewClient(TestTokenHelper.Propietario(e.NegocioId));

        var resp = await client.GetAsync("/api/citas");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var texto = await resp.Content.ReadAsStringAsync();
        SinContactoDelBorrado(texto);
        var citas = JsonDocument.Parse(texto).RootElement.EnumerateArray().ToList();
        citas.Should().HaveCount(3);
        resp.Headers.GetValues("X-Total-Count").Single().Should().Be("3");
        EsClienteEliminado(citas.Single(c => c.GetProperty("id").GetGuid() == e.CitaId));
        citas.Single(c => c.GetProperty("nombreCliente").GetString() == "Cliente Vivo")
            .GetProperty("clienteEliminado").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task ListaDeCitas_BuscarPorCodigoEncuentraLaDelClienteEliminado_PeroNoPorSuNombre()
    {
        var e = await SembrarAsync();
        var client = NewClient(TestTokenHelper.Propietario(e.NegocioId));

        var porCodigo = await client.GetFromJsonAsync<JsonElement>($"/api/citas?busqueda={e.Codigo}");
        var porNombre = await client.GetFromJsonAsync<JsonElement>("/api/citas?busqueda=Borrado");

        porCodigo.EnumerateArray().Should().ContainSingle()
            .Which.GetProperty("id").GetGuid().Should().Be(e.CitaId);
        porNombre.GetArrayLength().Should().Be(0, "the deleted client's name is no longer searchable");
    }

    [Fact]
    public async Task DetalleYCambioDeEstado_FuncionanConLaCitaDelClienteEliminado()
    {
        var e = await SembrarAsync();
        var client = NewClient(TestTokenHelper.Propietario(e.NegocioId));

        var detalle = await client.GetAsync($"/api/citas/{e.CitaId}");
        detalle.StatusCode.Should().Be(HttpStatusCode.OK, "it was a 404 through the INNER JOIN");
        EsClienteEliminado(await detalle.Content.ReadFromJsonAsync<JsonElement>());

        var cancelar = await client.PatchAsJsonAsync($"/api/citas/{e.CitaId}/estado",
            new { nuevoEstado = EstadosCitas.Cancelada, motivo = "Prueba" });
        cancelar.StatusCode.Should().Be(HttpStatusCode.OK, await cancelar.Content.ReadAsStringAsync());
        EsClienteEliminado(await cancelar.Content.ReadFromJsonAsync<JsonElement>());

        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.Citas.SingleAsync(c => c.Id == e.CitaId)).Estado.Should().Be(EstadosCitas.Cancelada);
        (await db.NotificacionesDashboard.SingleAsync(n => n.CitaId == e.CitaId)).Titulo
            .Should().Be("Cita cancelada — Cliente eliminado");
        // The deleted client stays deleted and is not touched by the save.
        (await db.Clientes.IgnoreQueryFilters().CountAsync(c => c.NegocioId == e.NegocioId && c.FechaEliminacion != null))
            .Should().Be(1);
    }

    [Fact]
    public async Task HistorialDePagos_IncluyeElPagoDelClienteEliminado()
    {
        var e = await SembrarAsync();
        var client = NewClient(TestTokenHelper.Propietario(e.NegocioId));

        var resp = await client.GetAsync("/api/citas/historial-pagos");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var texto = await resp.Content.ReadAsStringAsync();
        SinContactoDelBorrado(texto);
        var pago = JsonDocument.Parse(texto).RootElement.EnumerateArray().Should().ContainSingle().Subject;
        pago.GetProperty("id").GetGuid().Should().Be(e.CitaPagadaId);
        EsClienteEliminado(pago);
    }

    [Fact]
    public async Task Inicio_ProximasCitas_IncluyeLaDelClienteEliminado()
    {
        var e = await SembrarAsync();
        var client = NewClient(TestTokenHelper.Propietario(e.NegocioId));

        var resp = await client.GetAsync("/api/dashboard/resumen");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var texto = await resp.Content.ReadAsStringAsync();
        SinContactoDelBorrado(texto);
        var proximas = JsonDocument.Parse(texto).RootElement.GetProperty("proximasCitas").EnumerateArray().ToList();
        proximas.Should().HaveCount(2);
        proximas.Single(c => c.GetProperty("id").GetGuid() == e.CitaId)
            .GetProperty("nombreCliente").GetString().Should().Be("Cliente eliminado");
    }

    // ── Public: deliberately not reachable ────────────────────────────────────

    [Fact]
    public async Task Publico_PorCodigo_LaCitaDelClienteEliminadoNoSeExpone()
    {
        var e = await SembrarAsync();
        var client = NewClient();

        var cita = await client.GetAsync($"/api/publico/citas/{e.Codigo}");
        var ical = await client.GetAsync($"/api/publico/citas/{e.Codigo}/ical");
        var cancelar = await client.DeleteAsync($"/api/publico/citas/{e.Codigo}?email={EmailBorrado}");
        using var archivo = new MultipartFormDataContent
        {
            { new ByteArrayContent(new byte[] { 1, 2, 3 }), "archivo", "comprobante.png" },
        };
        var comprobante = await client.PostAsync($"/api/publico/citas/{e.Codigo}/comprobante", archivo);

        cita.StatusCode.Should().Be(HttpStatusCode.NotFound);
        ical.StatusCode.Should().Be(HttpStatusCode.NotFound);
        cancelar.StatusCode.Should().Be(HttpStatusCode.NotFound);
        comprobante.StatusCode.Should().Be(HttpStatusCode.NotFound);
        SinContactoDelBorrado(await cita.Content.ReadAsStringAsync());

        // The appointment itself is untouched: the business still has it.
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var guardada = await db.Citas.SingleAsync(c => c.Id == e.CitaId);
        guardada.Estado.Should().Be(EstadosCitas.Confirmada);
        guardada.ComprobanteUrl.Should().BeNull();
    }

    [Fact]
    public async Task Publico_MisCitas_ConElCorreoDelClienteEliminado_NoDevuelveNada()
    {
        var e = await SembrarAsync();

        var porCorreo = await NewClient().GetAsync($"/api/publico/mis-citas?slug={e.Slug}&email={EmailBorrado}");
        var porTelefono = await NewClient().GetAsync($"/api/publico/mis-citas?slug={e.Slug}&telefono={TelefonoBorrado}");
        var vivo = await NewClient().GetAsync($"/api/publico/mis-citas?slug={e.Slug}&telefono=5500000078");

        porCorreo.StatusCode.Should().Be(HttpStatusCode.OK);
        (await porCorreo.Content.ReadFromJsonAsync<JsonElement>()).GetArrayLength().Should().Be(0);
        (await porTelefono.Content.ReadFromJsonAsync<JsonElement>()).GetArrayLength().Should().Be(0);
        (await vivo.Content.ReadFromJsonAsync<JsonElement>()).GetArrayLength().Should().Be(1);
    }
}
