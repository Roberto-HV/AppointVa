using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using AppointVaAPI.Constants;
using AppointVaAPI.Controllers.V1;
using AppointVaAPI.Data;
using AppointVaAPI.Filters;
using AppointVaAPI.Models;
using AppointVaAPI.Services;
using AppointVaAPI.Services.IServices;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;
using NSubstitute;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>
/// Lote 5 (flujos sensibles): step-up before destructive admin actions, mandatory 2FA for the
/// step-up (never for the login), the delete impact figures, the owner reset link and the
/// one-step business + owner invitation.
/// </summary>
public class FlujosSensiblesAdminTests : CodigosRecuperacionTestBase
{
    public FlujosSensiblesAdminTests(CustomWebApplicationFactory factory) : base(factory) { }

    // ── Setup ───────────────────────────────────────────────────────────────

    private async Task<ApplicationUser> CrearAdminAsync(bool con2FA = false)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var email = $"admin-{Guid.NewGuid():N}@ejemplo.com";
        var admin = new ApplicationUser
        {
            Id = Guid.NewGuid(), UserName = email, Email = email, EmailConfirmed = true,
            Nombre = "Admin", Apellido = "Plataforma", Activo = true, FechaCreacion = DateTime.UtcNow
        };
        (await um.CreateAsync(admin, Contrasena)).Succeeded.Should().BeTrue();
        (await um.AddToRoleAsync(admin, Roles.SuperAdmin)).Succeeded.Should().BeTrue();
        if (con2FA) await HabilitarConCodigosAsync(admin);
        return admin;
    }

    private async Task<Negocio> CrearNegocioAsync()
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var negocio = new Negocio
        {
            Id = Guid.NewGuid(), Nombre = "Demo Lote 5", Slug = $"lote5-{Guid.NewGuid():N}"[..16],
            ZonaHoraria = "UTC", Activo = 1, Sector = "belleza",
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        };
        db.Negocios.Add(negocio);
        await db.SaveChangesAsync();
        return negocio;
    }

    private async Task<ApplicationUser> CrearDuenoAsync(Guid negocioId)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var email = $"dueno-{Guid.NewGuid():N}@ejemplo.com";
        var u = new ApplicationUser
        {
            Id = Guid.NewGuid(), UserName = email, Email = email, EmailConfirmed = true,
            Nombre = "Dueña", Apellido = "Demo", Activo = true, NegocioId = negocioId, FechaCreacion = DateTime.UtcNow
        };
        (await um.CreateAsync(u, Contrasena)).Succeeded.Should().BeTrue();
        (await um.AddToRoleAsync(u, Roles.Propietario)).Succeeded.Should().BeTrue();
        return u;
    }

    private static string TokenAdmin(ApplicationUser admin) =>
        TestTokenHelper.GenerarToken(Roles.SuperAdmin, userId: admin.Id);

    private async Task<string> PruebaAsync(Guid usuarioId)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var u = (await um.FindByIdAsync(usuarioId.ToString()))!;
        return scope.ServiceProvider.GetRequiredService<IReautenticacionService>().Emitir(u).Token;
    }

    private static IEmailService Correo(bool disponible = true, bool enviaOk = true)
    {
        var email = Substitute.For<IEmailService>();
        email.EnvioDisponible.Returns(disponible);
        email.EnviarEnlaceAccesoAsync(default!, default!, default!, default, default).ReturnsForAnyArgs(enviaOk);
        return email;
    }

    private HttpClient ClienteConCorreo(IEmailService email, string token, string? prueba = null)
    {
        var cliente = Factory.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<IEmailService>();
            s.AddScoped(_ => email);
        })).CreateClient();
        cliente.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (prueba is not null) cliente.DefaultRequestHeaders.Add(ReautenticacionService.Encabezado, prueba);
        return cliente;
    }

    private async Task<bool> ExisteNegocioAsync(Guid id)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.Negocios.AnyAsync(n => n.Id == id && n.FechaEliminacion == null);
    }

    private static async Task<string?> CodigoErrorAsync(HttpResponseMessage resp)
    {
        var cuerpo = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return cuerpo.TryGetProperty("codigoError", out var c) ? c.GetString() : null;
    }

    // ── 2FA: required for the step-up, never for the login ──────────────────

    [Fact]
    public async Task Login_SuperAdminSin2FA_NoSeBloquea()
    {
        var admin = await CrearAdminAsync();

        var resp = await NewClient().PostAsJsonAsync("/api/auth/login", new { email = admin.Email, contrasena = Contrasena });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var cuerpo = await resp.Content.ReadFromJsonAsync<JsonElement>();
        cuerpo.GetProperty("token").GetString().Should().NotBeNullOrEmpty();
        cuerpo.GetProperty("requiere2FA").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task Reautenticar_Sin2FA_PideActivarlo()
    {
        var admin = await CrearAdminAsync();

        var resp = await NewClient(TokenAdmin(admin)).PostAsJsonAsync("/api/auth/reautenticar",
            new { contrasena = Contrasena, codigo = "123456" });

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await CodigoErrorAsync(resp)).Should().Be(AutenticacionController.CodigoDosFactoresRequerido);
    }

    [Fact]
    public async Task Reautenticar_SoloSuperAdmin()
    {
        var negocio = await CrearNegocioAsync();
        var dueno = await CrearDuenoAsync(negocio.Id);

        var resp = await NewClient(TestTokenHelper.GenerarToken(Roles.Propietario, negocio.Id, dueno.Id))
            .PostAsJsonAsync("/api/auth/reautenticar", new { contrasena = Contrasena, codigo = "123456" });

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Reautenticar_ConContrasenaYCodigo_EmitePrueba_QueAbreLaAccion()
    {
        var admin = await CrearAdminAsync(con2FA: true);
        var negocio = await CrearNegocioAsync();
        var cliente = NewClient(TokenAdmin(admin));

        var mal = await cliente.PostAsJsonAsync("/api/auth/reautenticar", new { contrasena = "Incorrecta-1", codigo = await CodigoTotpAsync(admin.Id) });
        mal.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var sinCodigo = await cliente.PostAsJsonAsync("/api/auth/reautenticar", new { contrasena = Contrasena, codigo = "000000" });
        sinCodigo.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var ok = await cliente.PostAsJsonAsync("/api/auth/reautenticar", new { contrasena = Contrasena, codigo = await CodigoTotpAsync(admin.Id) });
        ok.StatusCode.Should().Be(HttpStatusCode.OK, await ok.Content.ReadAsStringAsync());
        var prueba = (await ok.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;

        cliente.DefaultRequestHeaders.Add(ReautenticacionService.Encabezado, prueba);
        (await cliente.DeleteAsync($"/api/negocios/{negocio.Id}")).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await ExisteNegocioAsync(negocio.Id)).Should().BeFalse();

        var acciones = (await AuditoriaAsync(admin.Id)).Select(a => a.Accion).ToList();
        acciones.Count(a => a == AccionesAuditoria.ReautenticacionFallida).Should().Be(2);
        acciones.Should().Contain(AccionesAuditoria.Reautenticado);
    }

    // ── Step-up proof: required, and not bypassable ─────────────────────────

    [Fact]
    public async Task Eliminar_SinPrueba_Responde403_YNoBorra()
    {
        var admin = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        var cliente = NewClient(TokenAdmin(admin));

        var duro = await cliente.DeleteAsync($"/api/admin/negocios/{negocio.Id}");
        var archivo = await cliente.DeleteAsync($"/api/negocios/{negocio.Id}");

        foreach (var resp in new[] { duro, archivo })
        {
            resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
            (await CodigoErrorAsync(resp)).Should().Be(RequiereReautenticacionAttribute.CodigoError);
        }
        (await ExisteNegocioAsync(negocio.Id)).Should().BeTrue();
    }

    [Fact]
    public async Task Eliminar_ConPruebaDeOtroAdmin_SeRechaza()
    {
        var admin = await CrearAdminAsync();
        var otro = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        var cliente = NewClient(TokenAdmin(admin));
        cliente.DefaultRequestHeaders.Add(ReautenticacionService.Encabezado, await PruebaAsync(otro.Id));

        (await cliente.DeleteAsync($"/api/negocios/{negocio.Id}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ExisteNegocioAsync(negocio.Id)).Should().BeTrue();
    }

    [Fact]
    public async Task Eliminar_ConPruebaVencida_SeRechaza()
    {
        var admin = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();

        // Same shape and key as a real proof, but already expired.
        var config = Factory.Services.GetRequiredService<IConfiguration>();
        string sello;
        await using (var scope = Factory.Services.CreateAsyncScope())
        {
            var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            sello = JwtService.HashSello((await um.FindByIdAsync(admin.Id.ToString()))!.SecurityStamp);
        }
        var vencida = new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(
            issuer: config["Jwt:Emisor"],
            audience: $"{config["Jwt:Audiencia"]}/{ReautenticacionService.Proposito}",
            claims:
            [
                new Claim(ClaimsTipos.UsuarioId, admin.Id.ToString()),
                new Claim(ReautenticacionService.ClaimProposito, ReautenticacionService.Proposito),
                new Claim(ClaimsTipos.ReautenticacionSello, sello),
            ],
            notBefore: DateTime.UtcNow.AddMinutes(-10),
            expires: DateTime.UtcNow.AddMinutes(-1),
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Clave"]!)), SecurityAlgorithms.HmacSha256)));

        var cliente = NewClient(TokenAdmin(admin));
        cliente.DefaultRequestHeaders.Add(ReautenticacionService.Encabezado, vencida);

        (await cliente.DeleteAsync($"/api/negocios/{negocio.Id}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ExisteNegocioAsync(negocio.Id)).Should().BeTrue();
    }

    [Fact]
    public async Task Prueba_DejaDeServir_AlCambiarElSelloDeSeguridad()
    {
        var admin = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        var prueba = await PruebaAsync(admin.Id);
        await using (var scope = Factory.Services.CreateAsyncScope())
        {
            // What a password change or turning 2FA on/off does.
            var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            await um.UpdateSecurityStampAsync((await um.FindByIdAsync(admin.Id.ToString()))!);
        }
        var cliente = NewClient(TokenAdmin(admin));
        cliente.DefaultRequestHeaders.Add(ReautenticacionService.Encabezado, prueba);

        (await cliente.DeleteAsync($"/api/negocios/{negocio.Id}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Prueba_NoSirveComoSesion_NiLaSesionComoPrueba()
    {
        var admin = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        var prueba = await PruebaAsync(admin.Id);

        // Its audience is not the session's: the bearer handler rejects it.
        (await NewClient(prueba).GetAsync("/api/auth/me")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await NewClient(prueba).GetAsync($"/api/admin/negocios/{negocio.Id}/impacto")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        // And the session token does not pass as a proof.
        var token = TokenAdmin(admin);
        var cliente = NewClient(token);
        cliente.DefaultRequestHeaders.Add(ReautenticacionService.Encabezado, token);
        (await cliente.DeleteAsync($"/api/negocios/{negocio.Id}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task PagoDePorVida_PidePrueba_ElMensualNo()
    {
        var admin = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        var cliente = NewClient(TokenAdmin(admin));

        var sinPrueba = await cliente.PostAsJsonAsync($"/api/admin/negocios/{negocio.Id}/pagos", new { mesesPagados = 1200, monto = 9999m });
        sinPrueba.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await CodigoErrorAsync(sinPrueba)).Should().Be(RequiereReautenticacionAttribute.CodigoError);

        (await cliente.PostAsJsonAsync($"/api/admin/negocios/{negocio.Id}/pagos", new { mesesPagados = 1, monto = 449m }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        cliente.DefaultRequestHeaders.Add(ReautenticacionService.Encabezado, await PruebaAsync(admin.Id));
        (await cliente.PostAsJsonAsync($"/api/admin/negocios/{negocio.Id}/pagos", new { mesesPagados = 1200, monto = 9999m }))
            .StatusCode.Should().Be(HttpStatusCode.OK);
    }

    private async Task<DateTime?> VencimientoAsync(Guid negocioId)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.Negocios.Where(n => n.Id == negocioId).Select(n => n.FechaVencimiento).SingleAsync();
    }

    [Fact]
    public async Task PagosAcumulados_QueLleganAAccesoPermanente_PidenPrueba()
    {
        var admin = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        var cliente = NewClient(TokenAdmin(admin));

        // 599 months alone are not lifetime: no proof.
        (await cliente.PostAsJsonAsync($"/api/admin/negocios/{negocio.Id}/pagos", new { mesesPagados = 599, monto = 1m }))
            .StatusCode.Should().Be(HttpStatusCode.OK);
        var tras599 = await VencimientoAsync(negocio.Id);

        // Stacked on the first one they would reach permanent access: proof required, nothing written.
        var segundo = await cliente.PostAsJsonAsync($"/api/admin/negocios/{negocio.Id}/pagos", new { mesesPagados = 599, monto = 1m });
        segundo.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await CodigoErrorAsync(segundo)).Should().Be(RequiereReautenticacionAttribute.CodigoError);
        (await VencimientoAsync(negocio.Id)).Should().Be(tras599);

        // With the proof it goes through.
        cliente.DefaultRequestHeaders.Add(ReautenticacionService.Encabezado, await PruebaAsync(admin.Id));
        (await cliente.PostAsJsonAsync($"/api/admin/negocios/{negocio.Id}/pagos", new { mesesPagados = 599, monto = 1m }))
            .StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task PagosMensualesNormales_NoPidenPrueba()
    {
        var admin = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        var cliente = NewClient(TokenAdmin(admin));

        foreach (var meses in new[] { 1, 12, 24 })
            (await cliente.PostAsJsonAsync($"/api/admin/negocios/{negocio.Id}/pagos", new { mesesPagados = meses, monto = 449m }))
                .StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task EditarPago_QueLlevaAAccesoPermanente_PidePrueba_ElRestoNo()
    {
        var admin = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        var cliente = NewClient(TokenAdmin(admin));
        var pago = await (await cliente.PostAsJsonAsync($"/api/admin/negocios/{negocio.Id}/pagos", new { mesesPagados = 1, monto = 449m }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var pagoId = pago.GetProperty("id").GetGuid();
        var desde = pago.GetProperty("periodoDesde").GetDateTime();
        var hasta = pago.GetProperty("periodoHasta").GetDateTime();

        // Amount and notes only: same due date, no proof.
        (await cliente.PatchAsJsonAsync($"/api/admin/pagos/{pagoId}", new { monto = 500m, notas = "ajuste", periodoDesde = desde, periodoHasta = hasta }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        // Pushing the period a century out is lifetime access by another door.
        var lejos = hasta.AddYears(100);
        var sinPrueba = await cliente.PatchAsJsonAsync($"/api/admin/pagos/{pagoId}", new { monto = 500m, periodoDesde = desde, periodoHasta = lejos });
        sinPrueba.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await CodigoErrorAsync(sinPrueba)).Should().Be(RequiereReautenticacionAttribute.CodigoError);
        (await VencimientoAsync(negocio.Id))!.Value.Date.Should().Be(hasta.Date);

        cliente.DefaultRequestHeaders.Add(ReautenticacionService.Encabezado, await PruebaAsync(admin.Id));
        (await cliente.PatchAsJsonAsync($"/api/admin/pagos/{pagoId}", new { monto = 500m, periodoDesde = desde, periodoHasta = lejos }))
            .StatusCode.Should().Be(HttpStatusCode.OK);
        (await VencimientoAsync(negocio.Id))!.Value.Date.Should().Be(lejos.Date);
    }

    // ── Delete impact ───────────────────────────────────────────────────────

    [Fact]
    public async Task Impacto_CuentaLoQueSeBorraria()
    {
        var admin = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        await using (var scope = Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var n = await db.Negocios.FirstAsync(x => x.Id == negocio.Id);
            n.LogoUrl = "https://cdn.ejemplo.com/logo.png";
            var empleado = new Empleado
            {
                Id = Guid.NewGuid(), NegocioId = negocio.Id, Nombre = "Ana", Activo = 1, FotoUrl = "https://cdn.ejemplo.com/ana.png",
                FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
            };
            var servicio = new Servicio
            {
                Id = Guid.NewGuid(), NegocioId = negocio.Id, Nombre = "Corte", DuracionMinutos = 30, Precio = 100,
                Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
            };
            var clientes = Enumerable.Range(0, 3).Select(i => new Cliente
            {
                Id = Guid.NewGuid(), NegocioId = negocio.Id, NombreCompleto = $"Cliente {i}", Telefono = $"55{i:D8}",
                FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
                // A soft-deleted client is erased too, so it counts.
                FechaEliminacion = i == 2 ? DateTime.UtcNow : null
            }).ToList();
            db.Empleados.Add(empleado);
            db.Servicios.Add(servicio);
            db.Clientes.AddRange(clientes);
            Cita NuevaCita(int dias) => new()
            {
                Id = Guid.NewGuid(), NegocioId = negocio.Id, ClienteId = clientes[0].Id, EmpleadoId = empleado.Id,
                ServicioId = servicio.Id, CodigoConfirmacion = $"L5{Guid.NewGuid():N}"[..8],
                InicioEn = DateTime.UtcNow.Date.AddDays(dias).AddHours(10), FinEn = DateTime.UtcNow.Date.AddDays(dias).AddHours(11),
                Precio = 100, Estado = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
            };
            db.Citas.AddRange(NuevaCita(3), NuevaCita(5), NuevaCita(-2), NuevaCita(-30), NuevaCita(-60));
            db.ImagenesNegocios.Add(new ImagenNegocio { Id = Guid.NewGuid(), NegocioId = negocio.Id, Url = "https://cdn.ejemplo.com/g1.png", Orden = 1, FechaCreacion = DateTime.UtcNow });
            db.PagosSuscripcion.Add(new PagoSuscripcion
            {
                Id = Guid.NewGuid(), NegocioId = negocio.Id, RegistradoPorId = admin.Id, FechaPago = DateTime.UtcNow,
                PeriodoDesde = DateTime.UtcNow.Date, PeriodoHasta = DateTime.UtcNow.Date.AddMonths(1), MesesPagados = 1, Monto = 449, NumeroPago = 1
            });
            await db.SaveChangesAsync();
        }

        var impacto = await NewClient(TokenAdmin(admin)).GetFromJsonAsync<JsonElement>($"/api/admin/negocios/{negocio.Id}/impacto");

        impacto.GetProperty("activo").GetBoolean().Should().BeTrue();
        impacto.GetProperty("citasProximas").GetInt32().Should().Be(2);
        impacto.GetProperty("citasPasadas").GetInt32().Should().Be(3);
        impacto.GetProperty("clientes").GetInt32().Should().Be(3);
        impacto.GetProperty("empleados").GetInt32().Should().Be(1);
        impacto.GetProperty("servicios").GetInt32().Should().Be(1);
        impacto.GetProperty("pagos").GetInt32().Should().Be(1);
        // Logo + gallery photo + employee photo.
        impacto.GetProperty("imagenes").GetInt32().Should().Be(3);
    }

    [Fact]
    public async Task Impacto_SoloSuperAdmin_Y404SiNoExiste()
    {
        var admin = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();

        (await NewClient(TestTokenHelper.Propietario(negocio.Id)).GetAsync($"/api/admin/negocios/{negocio.Id}/impacto"))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await NewClient().GetAsync($"/api/admin/negocios/{negocio.Id}/impacto"))
            .StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await NewClient(TokenAdmin(admin)).GetAsync($"/api/admin/negocios/{Guid.NewGuid()}/impacto"))
            .StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Owner reset link ────────────────────────────────────────────────────

    [Fact]
    public async Task EnlaceContrasena_EnviaElEnlaceDeRecuperacion_SinTocarLaContrasena_YAudita()
    {
        var admin = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        var dueno = await CrearDuenoAsync(negocio.Id);
        var email = Correo();
        var cliente = ClienteConCorreo(email, TokenAdmin(admin), await PruebaAsync(admin.Id));

        var resp = await cliente.PostAsync($"/api/negocios/{negocio.Id}/propietario/enlace-contrasena", null);

        var texto = await resp.Content.ReadAsStringAsync();
        resp.StatusCode.Should().Be(HttpStatusCode.OK, texto);
        texto.Should().Contain(dueno.Email!).And.NotContain("token=");
        await email.Received(1).EnviarEnlaceAccesoAsync(
            dueno.Email!, Arg.Any<string>(),
            Arg.Is<string>(u => u.Contains("/restablecer-contrasena?token=") && u.Contains(Uri.EscapeDataString(dueno.Email!)) && !u.Contains("invitacion=1")),
            false, negocio.Nombre);

        await using var scope = Factory.Services.CreateAsyncScope();
        var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        (await um.CheckPasswordAsync((await um.FindByIdAsync(dueno.Id.ToString()))!, Contrasena))
            .Should().BeTrue("the current password keeps working until the owner chooses a new one");

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var entrada = await db.AuditLogs.SingleAsync(a => a.EntidadId == negocio.Id.ToString()
            && a.Accion == AccionesAuditoria.PasswordPropietarioRestablecido);
        entrada.UsuarioId.Should().Be(admin.Id);
        entrada.Detalles.Should().Contain(dueno.Id.ToString()).And.Contain("enlace").And.NotContain(dueno.Email!);
    }

    [Fact]
    public async Task EnlaceContrasena_SinPrueba_NoEnviaNada()
    {
        var admin = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        await CrearDuenoAsync(negocio.Id);
        var email = Correo();

        var resp = await ClienteConCorreo(email, TokenAdmin(admin))
            .PostAsync($"/api/negocios/{negocio.Id}/propietario/enlace-contrasena", null);

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        await email.DidNotReceiveWithAnyArgs().EnviarEnlaceAccesoAsync(default!, default!, default!, default, default);
    }

    [Fact]
    public async Task EnlaceContrasena_ConCorreoApagado_ErrorClaro_SinAuditar()
    {
        var admin = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        await CrearDuenoAsync(negocio.Id);
        var email = Correo(disponible: false);

        var resp = await ClienteConCorreo(email, TokenAdmin(admin), await PruebaAsync(admin.Id))
            .PostAsync($"/api/negocios/{negocio.Id}/propietario/enlace-contrasena", null);

        resp.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        (await CodigoErrorAsync(resp)).Should().Be(NegociosController.CodigoCorreoNoDisponible);
        await email.DidNotReceiveWithAnyArgs().EnviarEnlaceAccesoAsync(default!, default!, default!, default, default);
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.AuditLogs.AnyAsync(a => a.EntidadId == negocio.Id.ToString())).Should().BeFalse();
    }

    [Fact]
    public async Task EnlaceContrasena_SiElProveedorFalla_Responde502()
    {
        var admin = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        await CrearDuenoAsync(negocio.Id);

        var resp = await ClienteConCorreo(Correo(enviaOk: false), TokenAdmin(admin), await PruebaAsync(admin.Id))
            .PostAsync($"/api/negocios/{negocio.Id}/propietario/enlace-contrasena", null);

        resp.StatusCode.Should().Be(HttpStatusCode.BadGateway);
        (await CodigoErrorAsync(resp)).Should().Be(NegociosController.CodigoCorreoNoEnviado);
        // Nothing went out, so nothing is recorded.
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.AuditLogs.AnyAsync(a => a.EntidadId == negocio.Id.ToString()
            && a.Accion == AccionesAuditoria.PasswordPropietarioRestablecido)).Should().BeFalse();
    }

    [Fact]
    public async Task CorreoDisponible_DiceSiSePuedeInvitar_SoloSuperAdmin()
    {
        var admin = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();

        foreach (var disponible in new[] { true, false })
        {
            var cuerpo = await ClienteConCorreo(Correo(disponible), TokenAdmin(admin))
                .GetFromJsonAsync<JsonElement>("/api/negocios/correo-disponible");
            cuerpo.GetProperty("envioDisponible").GetBoolean().Should().Be(disponible);
        }
        (await NewClient(TestTokenHelper.Propietario(negocio.Id)).GetAsync("/api/negocios/correo-disponible"))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ElEndpointViejo_DeEscribirLaContrasena_YaNoExiste()
    {
        var admin = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        await CrearDuenoAsync(negocio.Id);

        var resp = await NewClient(TokenAdmin(admin)).PatchAsJsonAsync($"/api/negocios/{negocio.Id}/propietario/password",
            new { nuevaPassword = "Otra-Clave-55" });

        resp.StatusCode.Should().BeOneOf(HttpStatusCode.NotFound, HttpStatusCode.MethodNotAllowed);
    }

    // ── One-step business + owner ───────────────────────────────────────────

    [Fact]
    public async Task CrearNegocioConPropietario_CreaAmbos_EInvitaPorEnlace()
    {
        var admin = await CrearAdminAsync();
        var email = Correo();
        var correoDueno = $"invitada-{Guid.NewGuid():N}@ejemplo.com";
        var slug = $"alta5-{Guid.NewGuid():N}"[..16];

        var resp = await ClienteConCorreo(email, TokenAdmin(admin)).PostAsJsonAsync("/api/negocios", new
        {
            nombre = "Estética Invitada", slug,
            propietario = new { nombre = "Laura", apellido = "Ríos", email = correoDueno }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created, await resp.Content.ReadAsStringAsync());
        var cuerpo = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var negocioId = cuerpo.GetProperty("id").GetGuid();
        cuerpo.GetProperty("invitacionEnviada").GetBoolean().Should().BeTrue();
        cuerpo.GetProperty("propietarioEmail").GetString().Should().Be(correoDueno);

        await email.Received(1).EnviarEnlaceAccesoAsync(correoDueno, "Laura",
            Arg.Is<string>(u => u.Contains("/restablecer-contrasena?token=") && u.Contains("invitacion=1")), true, "Estética Invitada");

        await using var scope = Factory.Services.CreateAsyncScope();
        var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var dueno = (await um.FindByEmailAsync(correoDueno))!;
        dueno.NegocioId.Should().Be(negocioId);
        (await um.IsInRoleAsync(dueno, Roles.Propietario)).Should().BeTrue();
        (await um.HasPasswordAsync(dueno)).Should().BeFalse("the owner chooses it from the invitation");

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var acciones = await db.AuditLogs.Where(a => a.EntidadId == negocioId.ToString()).Select(a => a.Accion).ToListAsync();
        acciones.Should().Contain([AccionesAuditoria.NegocioCreado, AccionesAuditoria.PropietarioCreado]);
    }

    [Fact]
    public async Task CrearNegocioConPropietario_ConCorreoApagado_NoCreaNada()
    {
        var admin = await CrearAdminAsync();
        var slug = $"alta5-{Guid.NewGuid():N}"[..16];

        var resp = await ClienteConCorreo(Correo(disponible: false), TokenAdmin(admin)).PostAsJsonAsync("/api/negocios", new
        {
            nombre = "Sin Correo", slug,
            propietario = new { nombre = "Laura", email = $"x-{Guid.NewGuid():N}@ejemplo.com" }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        var cuerpo = await resp.Content.ReadFromJsonAsync<JsonElement>();
        cuerpo.GetProperty("codigoError").GetString().Should().Be(NegociosController.CodigoCorreoNoDisponible);
        // Tells the admin the way out: create it without inviting.
        cuerpo.GetProperty("mensaje").GetString().Should().Be(NegociosController.MensajeCrearSinCorreo).And.Contain("sin invitarlo");
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.Negocios.AnyAsync(n => n.Slug == slug)).Should().BeFalse();
    }

    [Fact]
    public async Task CrearNegocioConPropietario_SiLaInvitacionLanza_CreaYDevuelveInvitacionNoEnviada()
    {
        var admin = await CrearAdminAsync();
        var email = Correo();
        email.EnviarEnlaceAccesoAsync(default!, default!, default!, default, default)
            .ReturnsForAnyArgs<Task<bool>>(_ => throw new HttpRequestException("proveedor caído"));
        var correoDueno = $"lanza-{Guid.NewGuid():N}@ejemplo.com";
        var slug = $"lanza-{Guid.NewGuid():N}"[..16];

        var resp = await ClienteConCorreo(email, TokenAdmin(admin)).PostAsJsonAsync("/api/negocios", new
        {
            nombre = "Invitación Fallida", slug,
            propietario = new { nombre = "Laura", email = correoDueno }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created, await resp.Content.ReadAsStringAsync());
        var cuerpo = await resp.Content.ReadFromJsonAsync<JsonElement>();
        cuerpo.GetProperty("invitacionEnviada").GetBoolean().Should().BeFalse();
        cuerpo.GetProperty("propietarioEmail").GetString().Should().Be(correoDueno);
        await using var scope = Factory.Services.CreateAsyncScope();
        var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        (await um.FindByEmailAsync(correoDueno)).Should().NotBeNull();
    }

    [Fact]
    public async Task CrearPropietario_SiLaInvitacionLanza_CreaYDevuelveInvitacionNoEnviada()
    {
        var admin = await CrearAdminAsync();
        var negocio = await CrearNegocioAsync();
        var email = Correo();
        email.EnviarEnlaceAccesoAsync(default!, default!, default!, default, default)
            .ReturnsForAnyArgs<Task<bool>>(_ => throw new TaskCanceledException("timeout"));
        var correoDueno = $"lanza-{Guid.NewGuid():N}@ejemplo.com";

        var resp = await ClienteConCorreo(email, TokenAdmin(admin))
            .PostAsJsonAsync($"/api/negocios/{negocio.Id}/propietario", new { nombre = "Laura", email = correoDueno });

        resp.StatusCode.Should().Be(HttpStatusCode.OK, await resp.Content.ReadAsStringAsync());
        var cuerpo = await resp.Content.ReadFromJsonAsync<JsonElement>();
        cuerpo.GetProperty("invitacionEnviada").GetBoolean().Should().BeFalse();
        cuerpo.GetProperty("mensaje").GetString().Should().Contain("Enviar enlace");
    }

    [Fact]
    public async Task CrearNegocioConPropietario_CorreoRepetido_409_SinNegocio()
    {
        var admin = await CrearAdminAsync();
        var otro = await CrearNegocioAsync();
        var existente = await CrearDuenoAsync(otro.Id);
        var slug = $"alta5-{Guid.NewGuid():N}"[..16];

        var resp = await ClienteConCorreo(Correo(), TokenAdmin(admin)).PostAsJsonAsync("/api/negocios", new
        {
            nombre = "Repetido", slug,
            propietario = new { nombre = "Laura", email = existente.Email }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Conflict);
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.Negocios.AnyAsync(n => n.Slug == slug)).Should().BeFalse();
    }

    [Fact]
    public async Task CrearNegocioSinPropietario_NoNecesitaCorreo()
    {
        var admin = await CrearAdminAsync();
        var email = Correo(disponible: false);

        var resp = await ClienteConCorreo(email, TokenAdmin(admin)).PostAsJsonAsync("/api/negocios",
            new { nombre = "Solo Negocio", slug = $"solo5-{Guid.NewGuid():N}"[..16] });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var cuerpo = await resp.Content.ReadFromJsonAsync<JsonElement>();
        cuerpo.GetProperty("invitacionEnviada").ValueKind.Should().Be(JsonValueKind.Null);
        await email.DidNotReceiveWithAnyArgs().EnviarEnlaceAccesoAsync(default!, default!, default!, default, default);
    }
}
