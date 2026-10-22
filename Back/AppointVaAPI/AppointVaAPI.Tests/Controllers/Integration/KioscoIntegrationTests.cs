using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AppointVaAPI.Constants;
using AppointVaAPI.Controllers.V1;
using AppointVaAPI.Data;
using AppointVaAPI.Helpers;
using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>
/// B9 (decision 3): the reception screen runs on a restricted kiosk token, and leaving it
/// checks the password without feeding the account lockout.
/// </summary>
public class KioscoIntegrationTests : IntegrationTestBase
{
    private const string Contrasena = "Contrasena123!";

    public KioscoIntegrationTests(CustomWebApplicationFactory factory) : base(factory) { }

    private sealed record Cuenta(ApplicationUser Usuario, Guid NegocioId, string TokenNormal);

    private async Task<Cuenta> CrearCuentaAsync(string rol = Roles.Propietario)
    {
        var negocioId = Guid.NewGuid();
        await Factory.SeedNegocioAsync(negocioId);

        await using var scope = Factory.Services.CreateAsyncScope();
        var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var email = $"kiosco-{Guid.NewGuid():N}@ejemplo.com";
        var usuario = new ApplicationUser
        {
            Id = Guid.NewGuid(), UserName = email, Email = email, EmailConfirmed = true,
            Nombre = "Dueña", Apellido = "Kiosco", Activo = true, NegocioId = negocioId,
            FechaCreacion = DateTime.UtcNow
        };
        (await um.CreateAsync(usuario, Contrasena)).Succeeded.Should().BeTrue();
        (await um.AddToRoleAsync(usuario, rol)).Succeeded.Should().BeTrue();

        return new Cuenta(usuario, negocioId, TestTokenHelper.GenerarToken(rol, negocioId, usuario.Id));
    }

    private async Task<string> AbrirKioscoAsync(Cuenta cuenta, string? refreshToken = null)
    {
        var resp = await NewClient(cuenta.TokenNormal).PostAsJsonAsync("/api/kiosco/sesion", new { refreshToken });
        resp.StatusCode.Should().Be(HttpStatusCode.OK, await resp.Content.ReadAsStringAsync());
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("token").GetString()!;
    }

    private Task<HttpResponseMessage> SalirAsync(string tokenKiosco, string contrasena) =>
        NewClient(tokenKiosco).PostAsJsonAsync("/api/kiosco/salir", new { contrasena });

    private async Task<List<string>> AccionesAuditadasAsync(Guid usuarioId)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.AuditLogs.Where(a => a.UsuarioId == usuarioId).Select(a => a.Accion).ToListAsync();
    }

    // ── Entering ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Sesion_Propietario_EmiteTokenKioscoDe12hSinRefreshYRevocaElRefreshDelDueno()
    {
        var cuenta = await CrearCuentaAsync();
        string refreshDueno;
        await using (var scope = Factory.Services.CreateAsyncScope())
            refreshDueno = await scope.ServiceProvider.GetRequiredService<IJwtService>()
                .GenerarRefreshTokenAsync(cuenta.Usuario.Id);

        var resp = await NewClient(cuenta.TokenNormal).PostAsJsonAsync("/api/kiosco/sesion", new { refreshToken = refreshDueno });

        resp.StatusCode.Should().Be(HttpStatusCode.OK, await resp.Content.ReadAsStringAsync());
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.TryGetProperty("refreshToken", out _).Should().BeFalse("the kiosk has no refresh token");
        body.GetProperty("usuario").GetProperty("rol").GetString().Should().Be(Roles.Kiosco);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(body.GetProperty("token").GetString());
        jwt.Claims.Single(c => c.Type == "role").Value.Should().Be(Roles.Kiosco);
        jwt.Claims.Single(c => c.Type == ClaimsTipos.NegocioId).Value.Should().Be(cuenta.NegocioId.ToString());
        jwt.ValidTo.Should().BeCloseTo(DateTime.UtcNow.AddHours(12), TimeSpan.FromMinutes(1));

        await using (var scope = Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            (await db.RefreshTokens.SingleAsync(rt => rt.Token == refreshDueno)).Revocado.Should().BeTrue();
        }
        (await AccionesAuditadasAsync(cuenta.Usuario.Id)).Should().Contain("KioscoIniciado");
    }

    [Fact]
    public async Task Sesion_SinSesion_Retorna401()
    {
        var resp = await NewClient().PostAsJsonAsync("/api/kiosco/sesion", new { });
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── What the kiosk token can reach ────────────────────────────────────────

    [Theory]
    [InlineData("GET", "/api/citas")]
    [InlineData("GET", "/api/empleados")]
    [InlineData("GET", "/api/negocios/perfil")]
    [InlineData("GET", "/api/auth/me")]
    [InlineData("GET", "/api/auth/2fa/estado")]
    [InlineData("POST", "/api/auth/cambiar-password")]
    [InlineData("POST", "/api/auth/logout")]
    [InlineData("DELETE", "/api/auth/cuenta")]
    [InlineData("GET", "/api/categorias")]
    [InlineData("GET", "/api/servicios")]
    [InlineData("GET", "/api/clientes")]
    [InlineData("GET", "/api/dashboard/resumen")]
    [InlineData("POST", "/api/kiosco/sesion")]
    [InlineData("POST", "/api/admin/hangfire/ticket")]
    public async Task TokenKiosco_FueraDelKiosco_Retorna403(string metodo, string ruta)
    {
        var cuenta = await CrearCuentaAsync();
        var kiosco = await AbrirKioscoAsync(cuenta);

        var peticion = new HttpRequestMessage(new HttpMethod(metodo), ruta)
        {
            Content = metodo == "GET" ? null : JsonContent.Create(new { })
        };
        var resp = await NewClient(kiosco).SendAsync(peticion);

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden, $"{metodo} {ruta} must refuse the kiosk token");
    }

    [Fact]
    public async Task TokenNormal_NoEntraAlKiosco()
    {
        var cuenta = await CrearCuentaAsync();
        var cliente = NewClient(cuenta.TokenNormal);

        (await cliente.GetAsync("/api/kiosco/agenda")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await cliente.PostAsJsonAsync("/api/kiosco/salir", new { contrasena = Contrasena }))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task DesafioDosFactores_NoAutorizaEndpointsConAuthorize()
    {
        var cuenta = await CrearCuentaAsync();
        string desafio;
        await using (var scope = Factory.Services.CreateAsyncScope())
            desafio = scope.ServiceProvider.GetRequiredService<IJwtService>().GenerarChallengeToken2FA(cuenta.Usuario.Id);

        var resp = await NewClient(desafio).GetAsync("/api/auth/me");

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Agenda ────────────────────────────────────────────────────────────────

    private async Task<(Guid EmpleadoId, Guid OtroEmpleadoId)> SembrarAgendaAsync(Guid negocioId, Guid? usuarioEmpleado = null)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var zona = (await db.Negocios.SingleAsync(n => n.Id == negocioId)).ZonaHoraria;
        var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ZonaHorariaHelper.Resolver(zona));

        var servicio = new Servicio
        {
            Id = Guid.NewGuid(), NegocioId = negocioId, Nombre = "Corte", DuracionMinutos = 30, Precio = 250m,
            Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        };
        Empleado NuevoEmpleado(string nombre, Guid? usuarioId = null) => new()
        {
            Id = Guid.NewGuid(), NegocioId = negocioId, Nombre = nombre, Activo = 1, UsuarioId = usuarioId,
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        };
        var empleado = NuevoEmpleado("Ana", usuarioEmpleado);
        var otro = NuevoEmpleado("Beto");
        var cliente = new Cliente
        {
            Id = Guid.NewGuid(), NegocioId = negocioId, NombreCompleto = "María de la Cruz López",
            Telefono = "5512345678", Email = "maria@ejemplo.com",
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        };
        Cita NuevaCita(Guid empleadoId, DateTime inicio) => new()
        {
            Id = Guid.NewGuid(), NegocioId = negocioId, CodigoConfirmacion = Guid.NewGuid().ToString("N")[..8],
            ClienteId = cliente.Id, EmpleadoId = empleadoId, ServicioId = servicio.Id,
            InicioEn = inicio, FinEn = inicio.AddMinutes(30), Estado = EstadosCitas.Confirmada,
            Precio = 250m, Pagada = true, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        };

        db.AddRange(servicio, empleado, otro, cliente,
            NuevaCita(empleado.Id, ahoraLocal),
            NuevaCita(otro.Id, ahoraLocal),
            NuevaCita(empleado.Id, ahoraLocal.Date.AddDays(1).AddHours(10)),
            NuevaCita(empleado.Id, ahoraLocal.Date.AddDays(-1).AddHours(10)));
        await db.SaveChangesAsync();
        return (empleado.Id, otro.Id);
    }

    [Fact]
    public async Task Agenda_DevuelveSoloHoyConNombreEInicialYSinContacto()
    {
        var cuenta = await CrearCuentaAsync();
        await SembrarAgendaAsync(cuenta.NegocioId);
        var kiosco = await AbrirKioscoAsync(cuenta);

        var resp = await NewClient(kiosco).GetAsync("/api/kiosco/agenda");

        resp.StatusCode.Should().Be(HttpStatusCode.OK, await resp.Content.ReadAsStringAsync());
        resp.Headers.CacheControl!.NoStore.Should().BeTrue();
        var texto = await resp.Content.ReadAsStringAsync();
        texto.Should().NotContain("5512345678").And.NotContain("maria@ejemplo.com").And.NotContain("López");
        var body = JsonDocument.Parse(texto).RootElement;
        body.GetProperty("mostrarIngresos").GetBoolean().Should().BeTrue();
        body.GetProperty("empleados").GetArrayLength().Should().Be(2);
        var citas = body.GetProperty("citas").EnumerateArray().ToList();
        citas.Should().HaveCount(2, "only today's appointments");
        citas.Should().AllSatisfy(c => c.GetProperty("nombreCliente").GetString().Should().Be("María C."));
    }

    [Fact]
    public async Task Agenda_AbiertaPorEmpleado_SoloSusCitasYSinIngresos()
    {
        var cuenta = await CrearCuentaAsync(Roles.Empleado);
        var (empleadoId, _) = await SembrarAgendaAsync(cuenta.NegocioId, cuenta.Usuario.Id);
        var kiosco = await AbrirKioscoAsync(cuenta);

        var body = await (await NewClient(kiosco).GetAsync("/api/kiosco/agenda")).Content.ReadFromJsonAsync<JsonElement>();

        body.GetProperty("mostrarIngresos").GetBoolean().Should().BeFalse();
        var citas = body.GetProperty("citas").EnumerateArray().ToList();
        citas.Should().ContainSingle().Which.GetProperty("empleadoId").GetGuid().Should().Be(empleadoId);
        citas[0].GetProperty("precio").GetDecimal().Should().Be(0);
    }

    [Fact]
    public async Task TokenKiosco_TrasCambiarLaContrasena_DejaDeValer()
    {
        var cuenta = await CrearCuentaAsync();
        var kiosco = await AbrirKioscoAsync(cuenta);

        await using (var scope = Factory.Services.CreateAsyncScope())
        {
            var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var usuario = await um.FindByIdAsync(cuenta.Usuario.Id.ToString());
            (await um.ChangePasswordAsync(usuario!, Contrasena, "OtraContrasena456!")).Succeeded.Should().BeTrue();
        }

        (await NewClient(kiosco).GetAsync("/api/kiosco/agenda")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Leaving ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Salir_ContrasenaCorrecta_DevuelveSesionNormalComoElLogin()
    {
        var cuenta = await CrearCuentaAsync();
        var kiosco = await AbrirKioscoAsync(cuenta);

        var resp = await SalirAsync(kiosco, Contrasena);

        resp.StatusCode.Should().Be(HttpStatusCode.OK, await resp.Content.ReadAsStringAsync());
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("requiere2FA").GetBoolean().Should().BeFalse();
        body.GetProperty("refreshToken").GetString().Should().NotBeNullOrEmpty();
        body.GetProperty("usuario").GetProperty("rol").GetString().Should().Be(Roles.Propietario);
        new JwtSecurityTokenHandler().ReadJwtToken(body.GetProperty("token").GetString())
            .Claims.Single(c => c.Type == "role").Value.Should().Be(Roles.Propietario);
        (await AccionesAuditadasAsync(cuenta.Usuario.Id)).Should().Contain("KioscoSalida");
    }

    [Fact]
    public async Task Salir_ConDosFactores_PideElCodigoSinEntregarLaSesion()
    {
        var cuenta = await CrearCuentaAsync();
        await using (var scope = Factory.Services.CreateAsyncScope())
        {
            var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            await um.SetTwoFactorEnabledAsync((await um.FindByIdAsync(cuenta.Usuario.Id.ToString()))!, true);
        }
        var kiosco = await AbrirKioscoAsync(cuenta);

        var body = await (await SalirAsync(kiosco, Contrasena)).Content.ReadFromJsonAsync<JsonElement>();

        body.GetProperty("requiere2FA").GetBoolean().Should().BeTrue();
        body.GetProperty("challengeToken").GetString().Should().NotBeNullOrEmpty();
        body.GetProperty("token").GetString().Should().BeEmpty();
        body.GetProperty("refreshToken").GetString().Should().BeEmpty();
    }

    [Fact]
    public async Task Salir_ContrasenasIncorrectas_NoTocanElBloqueoYSeLimitanA3Cada5Minutos()
    {
        var cuenta = await CrearCuentaAsync();
        var kiosco = await AbrirKioscoAsync(cuenta);

        var primera = await SalirAsync(kiosco, "mala-1");
        primera.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var cuerpo = await primera.Content.ReadFromJsonAsync<JsonElement>();
        cuerpo.GetProperty("codigoError").GetString().Should().Be(KioscoController.CodigoContrasenaIncorrecta);
        cuerpo.GetProperty("intentosRestantes").GetInt32().Should().Be(2);

        var segunda = await SalirAsync(kiosco, "mala-2");
        (await segunda.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("intentosRestantes").GetInt32().Should().Be(1);

        // The failure that spends the last attempt already says how long to wait.
        var tercera = await SalirAsync(kiosco, "mala-3");
        tercera.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        tercera.Headers.RetryAfter.Should().NotBeNull();
        var bloqueo = await tercera.Content.ReadFromJsonAsync<JsonElement>();
        bloqueo.GetProperty("codigoError").GetString().Should().Be(KioscoController.CodigoDemasiadosIntentos);
        bloqueo.GetProperty("reintentarEnSegundos").GetInt32().Should().BeInRange(1, 300);

        // Even the right password waits out the window.
        (await SalirAsync(kiosco, Contrasena)).StatusCode.Should().Be(HttpStatusCode.TooManyRequests);

        await using var scope = Factory.Services.CreateAsyncScope();
        var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var usuario = await um.FindByIdAsync(cuenta.Usuario.Id.ToString());
        (await um.GetAccessFailedCountAsync(usuario!)).Should().Be(0, "kiosk guesses must not lock the owner out");
        (await um.IsLockedOutAsync(usuario!)).Should().BeFalse();
        (await AccionesAuditadasAsync(cuenta.Usuario.Id)).Should()
            .Contain("KioscoSalidaFallida").And.Contain("KioscoSalidaBloqueada");
    }

    [Fact]
    public async Task Salir_BloqueadaRepetida_AuditaElBloqueoUnaSolaVez()
    {
        var cuenta = await CrearCuentaAsync();
        var kiosco = await AbrirKioscoAsync(cuenta);
        for (var i = 0; i < 3; i++) await SalirAsync(kiosco, $"mala-{i}");

        for (var i = 0; i < 5; i++)
            (await SalirAsync(kiosco, Contrasena)).StatusCode.Should().Be(HttpStatusCode.TooManyRequests);

        var acciones = await AccionesAuditadasAsync(cuenta.Usuario.Id);
        acciones.Count(a => a == KioscoController.AccionSalidaBloqueada).Should().Be(1);
        acciones.Count(a => a == KioscoController.AccionSalidaFallida).Should().Be(3);
    }

    [Fact]
    public async Task Salir_SalidasCorrectas_NoGastanIntentos()
    {
        var cuenta = await CrearCuentaAsync();
        for (var i = 0; i < 3; i++)
            (await SalirAsync(await AbrirKioscoAsync(cuenta), Contrasena)).StatusCode.Should().Be(HttpStatusCode.OK);

        var fallo = await SalirAsync(await AbrirKioscoAsync(cuenta), "mala");

        fallo.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await fallo.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("intentosRestantes").GetInt32().Should().Be(2);
    }

    [Fact]
    public void Salir_TieneLimiteDePeticionesPorIp()
    {
        var atributo = typeof(KioscoController).GetMethod(nameof(KioscoController.Salir))!
            .GetCustomAttributes(typeof(Microsoft.AspNetCore.RateLimiting.EnableRateLimitingAttribute), false)
            .Cast<Microsoft.AspNetCore.RateLimiting.EnableRateLimitingAttribute>()
            .SingleOrDefault();

        atributo.Should().NotBeNull();
        atributo!.PolicyName.Should().Be(KioscoController.PoliticaLimiteSalida);
    }

    [Fact]
    public async Task Salir_ElLimiteEsPorNegocio()
    {
        var bloqueada = await CrearCuentaAsync();
        var kioscoBloqueado = await AbrirKioscoAsync(bloqueada);
        for (var i = 0; i < 3; i++) await SalirAsync(kioscoBloqueado, $"mala-{i}");

        var otra = await CrearCuentaAsync();
        (await SalirAsync(await AbrirKioscoAsync(otra), Contrasena)).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ── Employees ─────────────────────────────────────────────────────────────

    private async Task VincularEmpleadoAsync(Cuenta cuenta)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Empleados.Add(new Empleado
        {
            Id = Guid.NewGuid(), NegocioId = cuenta.NegocioId, Nombre = "Ana", Activo = 1, UsuarioId = cuenta.Usuario.Id,
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Salir_AbiertoPorEmpleado_DevuelveLaSesionDelEmpleado()
    {
        var cuenta = await CrearCuentaAsync(Roles.Empleado);
        await VincularEmpleadoAsync(cuenta);
        var kiosco = await AbrirKioscoAsync(cuenta);

        var resp = await SalirAsync(kiosco, Contrasena);

        resp.StatusCode.Should().Be(HttpStatusCode.OK, await resp.Content.ReadAsStringAsync());
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var usuario = body.GetProperty("usuario");
        usuario.GetProperty("rol").GetString().Should().Be(Roles.Empleado);
        usuario.GetProperty("id").GetGuid().Should().Be(cuenta.Usuario.Id);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(body.GetProperty("token").GetString());
        jwt.Claims.Single(c => c.Type == "role").Value.Should().Be(Roles.Empleado);
    }

    [Fact]
    public async Task TokenKiosco_SiElEmpleadoPierdeElRol_DejaDeValer()
    {
        var cuenta = await CrearCuentaAsync(Roles.Empleado);
        await VincularEmpleadoAsync(cuenta);
        var kiosco = await AbrirKioscoAsync(cuenta);
        (await NewClient(kiosco).GetAsync("/api/kiosco/agenda")).StatusCode.Should().Be(HttpStatusCode.OK);

        await using (var scope = Factory.Services.CreateAsyncScope())
        {
            var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var usuario = await um.FindByIdAsync(cuenta.Usuario.Id.ToString());
            (await um.RemoveFromRoleAsync(usuario!, Roles.Empleado)).Succeeded.Should().BeTrue();
        }

        (await NewClient(kiosco).GetAsync("/api/kiosco/agenda")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await SalirAsync(kiosco, Contrasena)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Sesion_EmpleadoSinFicha_Retorna403ConMotivo()
    {
        var cuenta = await CrearCuentaAsync(Roles.Empleado);

        var resp = await NewClient(cuenta.TokenNormal).PostAsJsonAsync("/api/kiosco/sesion", new { });

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("codigoError").GetString().Should().Be(KioscoController.CodigoEmpleadoNoVinculado);
        body.GetProperty("mensaje").GetString().Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Agenda_EmpleadoDesvinculado_Retorna403ConMotivo()
    {
        var cuenta = await CrearCuentaAsync(Roles.Empleado);
        await VincularEmpleadoAsync(cuenta);
        var kiosco = await AbrirKioscoAsync(cuenta);
        await using (var scope = Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Empleados.RemoveRange(db.Empleados.Where(e => e.UsuarioId == cuenta.Usuario.Id));
            await db.SaveChangesAsync();
        }

        var resp = await NewClient(kiosco).GetAsync("/api/kiosco/agenda");

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await resp.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("codigoError").GetString().Should().Be(KioscoController.CodigoEmpleadoNoVinculado);
    }

    // ── Limit survives restarts ───────────────────────────────────────────────

    [Fact]
    public async Task Salir_FallosYaRegistrados_CuentanAunqueLaMemoriaEsteVacia()
    {
        // Stands in for a restart or another instance: the in-memory limiter has never seen
        // this negocio, but its failures are in the audit log.
        var cuenta = await CrearCuentaAsync();
        var kiosco = await AbrirKioscoAsync(cuenta);
        var zona = ZonaHorariaHelper.Resolver(AppointVaAPI.Services.AuditService.ZonaHorariaRegistro);
        await using (var scope = Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            foreach (var minutos in new[] { 4, 3, 2 })
                db.AuditLogs.Add(new AuditLog
                {
                    Id = Guid.NewGuid(), UsuarioId = cuenta.Usuario.Id, Accion = KioscoController.AccionSalidaFallida,
                    Entidad = "Negocio", EntidadId = cuenta.NegocioId.ToString(),
                    FechaEn = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow.AddMinutes(-minutos), zona)
                });
            // An old failure and another negocio's failure do not count.
            db.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(), Accion = KioscoController.AccionSalidaFallida, Entidad = "Negocio",
                EntidadId = Guid.NewGuid().ToString(), FechaEn = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zona)
            });
            await db.SaveChangesAsync();
        }

        var resp = await SalirAsync(kiosco, Contrasena);

        resp.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        // The oldest of the three (4 min ago) leaves the window in about a minute.
        (await resp.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("reintentarEnSegundos").GetInt32().Should().BeInRange(50, 70);
    }

    [Theory]
    [InlineData("María García López", "María G.")]
    [InlineData("María de la Cruz", "María C.")]
    [InlineData("  Juan  ", "Juan")]
    [InlineData("Ana de la", "Ana")]
    [InlineData("", "")]
    public void NombreConInicial_IgualQueElFront(string entrada, string esperado) =>
        KioscoController.NombreConInicial(entrada).Should().Be(esperado);
}
