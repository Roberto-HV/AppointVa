using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Services;
using AppointVaAPI.Services.IServices;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using NSubstitute;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>
/// Lote 1 (G2): every SuperAdmin mutating endpoint leaves an audit row with the actor,
/// the affected business and a short detail that never carries a password.
/// </summary>
public class AuditoriaAdminTests : IntegrationTestBase
{
    private const string ContrasenaPropietario = "Secreta-Propietario-9";

    public AuditoriaAdminTests(CustomWebApplicationFactory factory) : base(factory) { }

    // ── Setup ───────────────────────────────────────────────────────────────

    private async Task<Guid> CrearAdminAsync()
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var email = $"admin-{Guid.NewGuid():N}@ejemplo.com";
        var admin = new ApplicationUser
        {
            Id = Guid.NewGuid(), UserName = email, Email = email, EmailConfirmed = true,
            Nombre = "Admin", Apellido = "Plataforma", Activo = true, FechaCreacion = DateTime.UtcNow
        };
        (await um.CreateAsync(admin, "Admin-Clave-123")).Succeeded.Should().BeTrue();
        (await um.AddToRoleAsync(admin, Roles.SuperAdmin)).Succeeded.Should().BeTrue();
        return admin.Id;
    }

    private async Task<Negocio> CrearNegocioAsync(Action<Negocio>? ajustar = null)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var negocio = new Negocio
        {
            Id = Guid.NewGuid(),
            Nombre = $"Demo {Guid.NewGuid():N}"[..14],
            Slug = $"demo-{Guid.NewGuid():N}"[..14],
            Activo = 1,
            Sector = "belleza",
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow
        };
        ajustar?.Invoke(negocio);
        db.Negocios.Add(negocio);
        await db.SaveChangesAsync();
        return negocio;
    }

    private async Task<ApplicationUser> CrearPropietarioAsync(Guid negocioId, bool correoConfirmado = true)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var email = $"dueno-{Guid.NewGuid():N}@ejemplo.com";
        var u = new ApplicationUser
        {
            Id = Guid.NewGuid(), UserName = email, Email = email, EmailConfirmed = correoConfirmado,
            Nombre = "Dueño", Apellido = "Demo", Activo = true, NegocioId = negocioId, FechaCreacion = DateTime.UtcNow
        };
        (await um.CreateAsync(u, ContrasenaPropietario)).Succeeded.Should().BeTrue();
        (await um.AddToRoleAsync(u, Roles.Propietario)).Succeeded.Should().BeTrue();
        return u;
    }

    private async Task<Guid> CrearPlanAsync(string nombre)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var plan = new Plan { Id = Guid.NewGuid(), Nombre = nombre, PrecioMensual = 449, MaxEmpleados = 4, MaxCitasMes = 500, Activo = 1 };
        db.Planes.Add(plan);
        await db.SaveChangesAsync();
        return plan.Id;
    }

    private async Task<List<AuditLog>> EntradasAsync(Guid negocioId)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var id = negocioId.ToString();
        return await db.AuditLogs.Where(a => a.EntidadId == id).ToListAsync();
    }

    /// <summary>The single entry of <paramref name="accion"/> for the business, checked for actor and target.</summary>
    private async Task<AuditLog> EntradaAsync(Guid negocioId, string accion, Guid adminId)
    {
        var entradas = (await EntradasAsync(negocioId)).Where(a => a.Accion == accion).ToList();
        entradas.Should().ContainSingle($"'{accion}' must be audited exactly once");
        var e = entradas[0];
        e.UsuarioId.Should().Be(adminId);
        e.Entidad.Should().Be(AccionesAuditoria.EntidadNegocio);
        e.EntidadId.Should().Be(negocioId.ToString());
        e.Detalles.Should().NotBeNullOrWhiteSpace();
        e.Detalles!.Length.Should().BeLessThanOrEqualTo(500);
        return e;
    }

    private HttpClient ClienteAdmin(Guid adminId) =>
        NewClient(TestTokenHelper.GenerarToken(Roles.SuperAdmin, userId: adminId));

    /// <summary>Lote 5: a valid step-up proof for the admin, as POST api/auth/reautenticar would return.</summary>
    private async Task<string> PruebaReautenticacionAsync(Guid adminId)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var admin = (await um.FindByIdAsync(adminId.ToString()))!;
        return scope.ServiceProvider.GetRequiredService<IReautenticacionService>().Emitir(admin).Token;
    }

    /// <summary>Email switched on and accepting every message, so the owner flows can run.</summary>
    private static IEmailService CorreoDisponible()
    {
        var email = Substitute.For<IEmailService>();
        email.EnvioDisponible.Returns(true);
        email.EnviarEnlaceAccesoAsync(default!, default!, default!, default, default).ReturnsForAnyArgs(true);
        return email;
    }

    // ── NegociosController ──────────────────────────────────────────────────

    [Fact]
    public async Task CrearNegocio_QuedaAuditado()
    {
        var adminId = await CrearAdminAsync();
        var slug = $"alta-{Guid.NewGuid():N}"[..14];

        var resp = await ClienteAdmin(adminId).PostAsJsonAsync("/api/negocios", new { nombre = "Estética Demo", slug });
        resp.StatusCode.Should().Be(HttpStatusCode.Created, await resp.Content.ReadAsStringAsync());
        var id = (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        var e = await EntradaAsync(id, AccionesAuditoria.NegocioCreado, adminId);
        e.Detalles.Should().Contain("Estética Demo").And.Contain(slug);
    }

    [Fact]
    public async Task ActivarYDesactivar_QuedanAuditados()
    {
        var adminId = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync(n => n.Activo = 0);
        var cliente = ClienteAdmin(adminId);

        (await cliente.PatchAsync($"/api/negocios/{negocio.Id}/activar", null)).EnsureSuccessStatusCode();
        (await cliente.PatchAsync($"/api/negocios/{negocio.Id}/desactivar", null)).EnsureSuccessStatusCode();

        (await EntradaAsync(negocio.Id, AccionesAuditoria.NegocioActivado, adminId)).Detalles.Should().Contain(negocio.Nombre);
        (await EntradaAsync(negocio.Id, AccionesAuditoria.NegocioDesactivado, adminId)).Detalles.Should().Contain(negocio.Nombre);
    }

    [Fact]
    public async Task Archivar_QuedaAuditado()
    {
        var adminId = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        var cliente = ClienteAdmin(adminId);
        cliente.DefaultRequestHeaders.Add(ReautenticacionService.Encabezado, await PruebaReautenticacionAsync(adminId));

        (await cliente.DeleteAsync($"/api/negocios/{negocio.Id}")).StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await EntradaAsync(negocio.Id, AccionesAuditoria.NegocioArchivado, adminId)).Detalles.Should().Contain(negocio.Slug);
    }

    [Fact]
    public async Task Colores_QuedanAuditados_ConAntesYDespues()
    {
        var adminId = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync(n => n.ColorPrimario = "#111111");

        (await ClienteAdmin(adminId).PatchAsJsonAsync($"/api/negocios/{negocio.Id}/colores",
            new { colorPrimario = "#222222", colorSecundario = "#333333" })).EnsureSuccessStatusCode();

        var e = await EntradaAsync(negocio.Id, AccionesAuditoria.ColoresCambiados, adminId);
        e.Detalles.Should().Contain("#111111").And.Contain("#222222").And.Contain("#333333");
    }

    [Fact]
    public async Task ConfirmarCorreo_QuedaAuditado_SoloSiCambia()
    {
        var adminId = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        var dueno = await CrearPropietarioAsync(negocio.Id, correoConfirmado: false);
        var cliente = ClienteAdmin(adminId);

        (await cliente.PatchAsync($"/api/negocios/{negocio.Id}/confirmar-email", null)).EnsureSuccessStatusCode();
        // Already confirmed: nothing changes, so no second row.
        (await cliente.PatchAsync($"/api/negocios/{negocio.Id}/confirmar-email", null)).EnsureSuccessStatusCode();

        (await EntradaAsync(negocio.Id, AccionesAuditoria.CorreoConfirmadoManual, adminId))
            .Detalles.Should().Contain(dueno.Id.ToString());
    }

    [Fact]
    public async Task CrearPropietario_QuedaAuditado_ComoInvitacion()
    {
        var adminId = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        var cliente = Factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<IEmailService>();
            s.AddScoped(_ => CorreoDisponible());
        })).CreateClient();
        cliente.DefaultRequestHeaders.Authorization = new("Bearer", TestTokenHelper.GenerarToken(Roles.SuperAdmin, userId: adminId));

        var resp = await cliente.PostAsJsonAsync($"/api/negocios/{negocio.Id}/propietario",
            new { email = $"nuevo-{Guid.NewGuid():N}@ejemplo.com", nombre = "Nueva", apellido = "Dueña" });
        resp.StatusCode.Should().Be(HttpStatusCode.OK, await resp.Content.ReadAsStringAsync());

        var e = await EntradaAsync(negocio.Id, AccionesAuditoria.PropietarioCreado, adminId);
        e.Detalles.Should().Contain("invitado por enlace");
    }

    // ── SuscripcionAdminController ──────────────────────────────────────────

    [Fact]
    public async Task Pagos_RegistrarEditarYEliminar_QuedanAuditados_SinLasNotas()
    {
        var adminId = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        var cliente = ClienteAdmin(adminId);
        const string notas = "transferencia con referencia privada 4455";

        var alta = await cliente.PostAsJsonAsync($"/api/admin/negocios/{negocio.Id}/pagos",
            new { mesesPagados = 2, monto = 898m, notas });
        alta.StatusCode.Should().Be(HttpStatusCode.OK, await alta.Content.ReadAsStringAsync());
        var pagoId = (await alta.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        var hoy = DateTime.UtcNow.Date;
        (await cliente.PatchAsJsonAsync($"/api/admin/pagos/{pagoId}", new
        {
            monto = 900m,
            notas = notas + " corregida",
            periodoDesde = hoy.ToString("yyyy-MM-dd"),
            periodoHasta = hoy.AddMonths(2).ToString("yyyy-MM-dd"),
        })).EnsureSuccessStatusCode();

        (await cliente.DeleteAsync($"/api/admin/pagos/{pagoId}")).EnsureSuccessStatusCode();

        var registrado = await EntradaAsync(negocio.Id, AccionesAuditoria.PagoRegistrado, adminId);
        registrado.Detalles.Should().Contain("898").And.Contain(pagoId.ToString());
        var editado = await EntradaAsync(negocio.Id, AccionesAuditoria.PagoEditado, adminId);
        editado.Detalles.Should().Contain("898").And.Contain("900").And.Contain("Notas cambiadas: Sí");
        var eliminado = await EntradaAsync(negocio.Id, AccionesAuditoria.PagoEliminado, adminId);
        eliminado.Detalles.Should().Contain(pagoId.ToString());

        foreach (var e in new[] { registrado, editado, eliminado })
            e.Detalles.Should().NotContain("referencia privada");
    }

    [Fact]
    public async Task Interruptores_YEmpleadosExtra_QuedanAuditados()
    {
        var adminId = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        var cliente = ClienteAdmin(adminId);

        (await cliente.PatchAsJsonAsync($"/api/admin/negocios/{negocio.Id}/modulo-pagos", new { habilitado = true })).EnsureSuccessStatusCode();
        (await cliente.PostAsync($"/api/admin/negocios/{negocio.Id}/tester", null)).EnsureSuccessStatusCode();
        (await cliente.PatchAsJsonAsync($"/api/admin/negocios/{negocio.Id}/empleados-extra", new { empleadosExtra = 3 })).EnsureSuccessStatusCode();
        (await cliente.PatchAsJsonAsync($"/api/admin/negocios/{negocio.Id}/sector", new { sector = "salud" })).EnsureSuccessStatusCode();

        (await EntradaAsync(negocio.Id, AccionesAuditoria.ModuloPagosCambiado, adminId)).Detalles.Should().Contain("No → Sí");
        (await EntradaAsync(negocio.Id, AccionesAuditoria.TesterCambiado, adminId)).Detalles.Should().Contain("No → Sí");
        (await EntradaAsync(negocio.Id, AccionesAuditoria.EmpleadosExtraCambiado, adminId)).Detalles.Should().Contain("0 → 3");
        (await EntradaAsync(negocio.Id, AccionesAuditoria.SectorCambiado, adminId)).Detalles.Should().Contain("belleza → salud");
    }

    private async Task<bool> EsTesterAsync(Guid negocioId)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.Negocios.Where(n => n.Id == negocioId).Select(n => n.EsTester).SingleAsync();
    }

    private static async Task<bool> PostTesterAsync(HttpClient cliente, Guid negocioId, string query = "")
    {
        var resp = await cliente.PostAsync($"/api/admin/negocios/{negocioId}/tester{query}", null);
        resp.StatusCode.Should().Be(HttpStatusCode.OK, await resp.Content.ReadAsStringAsync());
        return (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("esTester").GetBoolean();
    }

    [Fact]
    public async Task Tester_ValorExplicito_EsIdempotente_YSoloAuditaElCambioReal()
    {
        var adminId = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        var cliente = ClienteAdmin(adminId);

        (await PostTesterAsync(cliente, negocio.Id, "?esTester=true")).Should().BeTrue();
        // A repeated request (a stale "Deshacer", a retry after a lost response) stays put.
        (await PostTesterAsync(cliente, negocio.Id, "?esTester=true")).Should().BeTrue();
        (await EsTesterAsync(negocio.Id)).Should().BeTrue();

        // Only the real change is audited: the no-op second request writes no row.
        (await EntradaAsync(negocio.Id, AccionesAuditoria.TesterCambiado, adminId)).Detalles.Should().Contain("No → Sí");

        (await PostTesterAsync(cliente, negocio.Id, "?esTester=false")).Should().BeFalse();
        (await EsTesterAsync(negocio.Id)).Should().BeFalse();
        var entradas = (await EntradasAsync(negocio.Id)).Where(a => a.Accion == AccionesAuditoria.TesterCambiado).ToList();
        entradas.Should().HaveCount(2);
        entradas.Should().ContainSingle(e => e.Detalles!.Contains("Sí → No"));
    }

    [Fact]
    public async Task Tester_SinValor_SigueAlternando()
    {
        var adminId = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        var cliente = ClienteAdmin(adminId);

        (await PostTesterAsync(cliente, negocio.Id)).Should().BeTrue();
        (await PostTesterAsync(cliente, negocio.Id)).Should().BeFalse();
        (await EsTesterAsync(negocio.Id)).Should().BeFalse();
        (await EntradasAsync(negocio.Id)).Count(a => a.Accion == AccionesAuditoria.TesterCambiado).Should().Be(2);
    }

    [Fact]
    public async Task Tester_SoloParaSuperAdmin()
    {
        var negocio = await CrearNegocioAsync();

        (await NewClient(TestTokenHelper.Propietario()).PostAsync($"/api/admin/negocios/{negocio.Id}/tester?esTester=true", null))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await EsTesterAsync(negocio.Id)).Should().BeFalse();
    }

    [Fact]
    public async Task CambiarPlan_QuedaAuditado_ConPlanAnteriorYNuevo()
    {
        var adminId = await CrearAdminAsync();
        var basico = await CrearPlanAsync("Basico");
        var pro = await CrearPlanAsync("Pro");
        var negocio = await CrearNegocioAsync(n => n.PlanId = basico);

        (await ClienteAdmin(adminId).PatchAsJsonAsync($"/api/admin/negocios/{negocio.Id}/plan", new { planId = pro }))
            .EnsureSuccessStatusCode();

        (await EntradaAsync(negocio.Id, AccionesAuditoria.PlanCambiado, adminId))
            .Detalles.Should().Contain("Basico → Pro").And.Contain("Módulo de pagos: No → Sí");
    }

    [Fact]
    public async Task AbrirPanelDeTareas_QuedaAuditado()
    {
        var adminId = await CrearAdminAsync();

        (await ClienteAdmin(adminId).PostAsync("/api/admin/hangfire/ticket", null)).EnsureSuccessStatusCode();

        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.AuditLogs.CountAsync(a => a.UsuarioId == adminId && a.Accion == AccionesAuditoria.PanelTareasAbierto))
            .Should().Be(1);
    }

    [Fact]
    public async Task EliminarNegocio_SiLaBitacoraFalla_NoBorraNada_YResponde503()
    {
        var adminId = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync(n => n.LogoUrl = "https://cdn.ejemplo.com/logo.png");
        var audit = Substitute.For<IAuditService>();
        audit.RegistrarObligatorioAsync(default!).ReturnsForAnyArgs(false);
        var blob = Substitute.For<IBlobStorageService>();
        var factory = Factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<IAuditService>();
            s.AddScoped(_ => audit);
            s.RemoveAll<IBlobStorageService>();
            s.AddScoped(_ => blob);
        }));
        var cliente = factory.CreateClient();
        cliente.DefaultRequestHeaders.Authorization = new("Bearer", TestTokenHelper.GenerarToken(Roles.SuperAdmin, userId: adminId));
        cliente.DefaultRequestHeaders.Add(ReautenticacionService.Encabezado, await PruebaReautenticacionAsync(adminId));

        var resp = await cliente.DeleteAsync($"/api/admin/negocios/{negocio.Id}");

        resp.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        await audit.Received(1).RegistrarObligatorioAsync(
            AccionesAuditoria.NegocioEliminado, AccionesAuditoria.EntidadNegocio, negocio.Id.ToString(),
            Arg.Is<string>(d => d.Contains(negocio.Nombre) && d.Contains(negocio.Slug)), null);
        await blob.DidNotReceiveWithAnyArgs().EliminarImagenAsync(default!);
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.Negocios.AnyAsync(n => n.Id == negocio.Id)).Should().BeTrue();
    }

    [Fact]
    // The email goes out first (no transaction held across the provider call). If the row then
    // cannot be written the send cannot be recalled: a clear 500 that says so (plus an Error log).
    public async Task EnlaceContrasena_SiLaBitacoraFallaTrasEnviar_Responde500_QueDiceQueSeEnvioSinRegistro()
    {
        var adminId = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        await CrearPropietarioAsync(negocio.Id);
        var audit = Substitute.For<IAuditService>();
        audit.RegistrarObligatorioAsync(default!).ReturnsForAnyArgs(false);
        var email = CorreoDisponible();
        var cliente = Factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<IAuditService>();
            s.AddScoped(_ => audit);
            s.RemoveAll<IEmailService>();
            s.AddScoped(_ => email);
        })).CreateClient();
        cliente.DefaultRequestHeaders.Authorization = new("Bearer", TestTokenHelper.GenerarToken(Roles.SuperAdmin, userId: adminId));
        cliente.DefaultRequestHeaders.Add(ReautenticacionService.Encabezado, await PruebaReautenticacionAsync(adminId));

        var resp = await cliente.PostAsync($"/api/negocios/{negocio.Id}/propietario/enlace-contrasena", null);

        resp.StatusCode.Should().Be(HttpStatusCode.InternalServerError);
        var cuerpo = await resp.Content.ReadFromJsonAsync<JsonElement>();
        cuerpo.GetProperty("mensaje").GetString().Should().Contain("Enviamos el enlace").And.Contain("bitácora");
        cuerpo.GetProperty("codigoError").GetString().Should().Be(AppointVaAPI.Controllers.V1.NegociosController.CodigoEnlaceSinAuditoria);
        await email.ReceivedWithAnyArgs(1).EnviarEnlaceAccesoAsync(default!, default!, default!, default, default);
    }

    // ── AuditAdminController ────────────────────────────────────────────────

    [Fact]
    public async Task Listado_MuestraElNombreDelNegocio_YFiltraPorGrupo()
    {
        var adminId = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        var cliente = ClienteAdmin(adminId);
        (await cliente.PatchAsJsonAsync($"/api/admin/negocios/{negocio.Id}/empleados-extra", new { empleadosExtra = 1 })).EnsureSuccessStatusCode();
        (await cliente.PostAsync("/api/auth/logout", JsonContent.Create(new { refreshToken = "x" }))).EnsureSuccessStatusCode();

        var admin = await cliente.GetFromJsonAsync<JsonElement>($"/api/admin/audit?grupo={AccionesAuditoria.GrupoAdministracion}&usuarioId={adminId}");
        var filas = admin.GetProperty("datos").EnumerateArray().ToList();
        filas.Should().ContainSingle();
        filas[0].GetProperty("accion").GetString().Should().Be(AccionesAuditoria.EmpleadosExtraCambiado);
        filas[0].GetProperty("negocioNombre").GetString().Should().Be(negocio.Nombre);

        var todas = await cliente.GetFromJsonAsync<JsonElement>($"/api/admin/audit?usuarioId={adminId}");
        todas.GetProperty("total").GetInt32().Should().Be(2);

        (await cliente.GetAsync("/api/admin/audit?grupo=inventado")).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Listado_FiltraPorNegocio_SoloSusEntradas()
    {
        var adminId = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        var otro = await CrearNegocioAsync();
        var cliente = ClienteAdmin(adminId);
        (await cliente.PatchAsJsonAsync($"/api/admin/negocios/{negocio.Id}/empleados-extra", new { empleadosExtra = 1 })).EnsureSuccessStatusCode();
        (await cliente.PatchAsJsonAsync($"/api/admin/negocios/{negocio.Id}/modulo-pagos", new { habilitado = true })).EnsureSuccessStatusCode();
        (await cliente.PatchAsJsonAsync($"/api/admin/negocios/{otro.Id}/empleados-extra", new { empleadosExtra = 2 })).EnsureSuccessStatusCode();
        // The admin's own logout is not about any business: it never shows up in a business's activity.
        (await cliente.PostAsync("/api/auth/logout", JsonContent.Create(new { refreshToken = "x" }))).EnsureSuccessStatusCode();

        var propias = await cliente.GetFromJsonAsync<JsonElement>($"/api/admin/audit?negocioId={negocio.Id}");
        propias.GetProperty("total").GetInt32().Should().Be(2);
        var filas = propias.GetProperty("datos").EnumerateArray().ToList();
        filas.Select(f => f.GetProperty("entidadId").GetString()).Should().AllBe(negocio.Id.ToString());
        filas.Select(f => f.GetProperty("accion").GetString()).Should().BeEquivalentTo(
            [AccionesAuditoria.EmpleadosExtraCambiado, AccionesAuditoria.ModuloPagosCambiado]);
        filas.Should().AllSatisfy(f => f.GetProperty("negocioNombre").GetString().Should().Be(negocio.Nombre));

        var delOtro = await cliente.GetFromJsonAsync<JsonElement>($"/api/admin/audit?negocioId={otro.Id}");
        delOtro.GetProperty("total").GetInt32().Should().Be(1);

        // Combines with the other filters.
        var porAccion = await cliente.GetFromJsonAsync<JsonElement>(
            $"/api/admin/audit?negocioId={negocio.Id}&accion={AccionesAuditoria.ModuloPagosCambiado}");
        porAccion.GetProperty("total").GetInt32().Should().Be(1);

        (await cliente.GetAsync("/api/admin/audit?negocioId=no-es-guid")).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Listado_PorNegocio_SoloParaSuperAdmin()
    {
        (await NewClient(TestTokenHelper.Propietario()).GetAsync($"/api/admin/audit?negocioId={Guid.NewGuid()}"))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Catalogo_DevuelveTodasLasAcciones_ConEtiquetaYGrupo()
    {
        var cuerpo = await ClienteAdmin(Guid.NewGuid()).GetFromJsonAsync<JsonElement>("/api/admin/audit/acciones");

        var acciones = cuerpo.GetProperty("acciones").EnumerateArray()
            .Select(a => a.GetProperty("accion").GetString()).ToList();
        acciones.Should().BeEquivalentTo(AccionesAuditoria.Catalogo.Select(a => a.Accion));
        cuerpo.GetProperty("grupos").GetArrayLength().Should().Be(AccionesAuditoria.Grupos.Count);
    }

    [Fact]
    public async Task Catalogo_SoloParaSuperAdmin()
    {
        (await NewClient(TestTokenHelper.Propietario()).GetAsync("/api/admin/audit/acciones"))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
