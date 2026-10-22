using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>Shared setup for the B8 (decision 9) recovery-code tests.</summary>
public abstract class CodigosRecuperacionTestBase : IntegrationTestBase
{
    protected const string Contrasena = "Contrasena123!";

    protected CodigosRecuperacionTestBase(CustomWebApplicationFactory factory) : base(factory) { }

    protected async Task<ApplicationUser> CrearUsuarioAsync()
    {
        var negocioId = Guid.NewGuid();
        await Factory.SeedNegocioAsync(negocioId);
        await using var scope = Factory.Services.CreateAsyncScope();
        var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var email = $"rec-{Guid.NewGuid():N}@ejemplo.com";
        var usuario = new ApplicationUser
        {
            Id = Guid.NewGuid(), UserName = email, Email = email, EmailConfirmed = true,
            Nombre = "Dueña", Apellido = "Segura", Activo = true, NegocioId = negocioId,
            FechaCreacion = DateTime.UtcNow
        };
        (await um.CreateAsync(usuario, Contrasena)).Succeeded.Should().BeTrue();
        (await um.AddToRoleAsync(usuario, Roles.Propietario)).Succeeded.Should().BeTrue();
        return usuario;
    }

    /// <summary>Turns 2FA on directly and returns the plain codes Identity generated.</summary>
    protected async Task<List<string>> HabilitarConCodigosAsync(ApplicationUser usuario)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var u = (await um.FindByIdAsync(usuario.Id.ToString()))!;
        await um.ResetAuthenticatorKeyAsync(u);
        await um.SetTwoFactorEnabledAsync(u, true);
        return (await um.GenerateNewTwoFactorRecoveryCodesAsync(u, 10))!.ToList();
    }

    protected string TokenDe(ApplicationUser u) =>
        TestTokenHelper.GenerarToken(Roles.Propietario, u.NegocioId, u.Id);

    protected async Task<string> DesafioAsync(ApplicationUser u)
    {
        var resp = await NewClient().PostAsJsonAsync("/api/auth/login", new { email = u.Email, contrasena = Contrasena });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("requiere2FA").GetBoolean().Should().BeTrue();
        return body.GetProperty("challengeToken").GetString()!;
    }

    protected Task<HttpResponseMessage> VerificarConCodigoRecuperacionAsync(string desafio, string codigo) =>
        NewClient().PostAsJsonAsync("/api/auth/2fa/verificar", new { challengeToken = desafio, codigoRecuperacion = codigo });

    protected async Task<List<AuditLog>> AuditoriaAsync(Guid usuarioId)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.AuditLogs.Where(a => a.UsuarioId == usuarioId).ToListAsync();
    }

    protected async Task<string?> ValorGuardadoAsync(Guid usuarioId)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.UserTokens
            .Where(t => t.UserId == usuarioId
                && t.LoginProvider == UserStoreCodigosRecuperacion.ProveedorInterno
                && t.Name == UserStoreCodigosRecuperacion.NombreToken)
            .Select(t => t.Value)
            .FirstOrDefaultAsync();
    }

    /// <summary>RFC 6238 code for Identity's authenticator key (SHA-1, 30 s, 6 digits).</summary>
    protected async Task<string> CodigoTotpAsync(Guid usuarioId)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var u = (await um.FindByIdAsync(usuarioId.ToString()))!;
        var llave = Base32(await um.GetAuthenticatorKeyAsync(u) ?? "");
        var paso = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;
        var contador = BitConverter.GetBytes(paso);
        if (BitConverter.IsLittleEndian) Array.Reverse(contador);
        var hash = HMACSHA1.HashData(llave, contador);
        var o = hash[^1] & 0x0F;
        var binario = ((hash[o] & 0x7F) << 24) | (hash[o + 1] << 16) | (hash[o + 2] << 8) | hash[o + 3];
        return (binario % 1_000_000).ToString("D6");
    }

    private static byte[] Base32(string texto)
    {
        const string alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var bits = 0; var valor = 0; var salida = new List<byte>();
        foreach (var c in texto.ToUpperInvariant().TrimEnd('='))
        {
            valor = (valor << 5) | alfabeto.IndexOf(c);
            bits += 5;
            if (bits >= 8) { salida.Add((byte)(valor >> (bits - 8))); bits -= 8; }
        }
        return salida.ToArray();
    }
}

/// <summary>Login with a recovery code: single use, audited, hashed at rest.</summary>
public class CodigosRecuperacionLoginTests : CodigosRecuperacionTestBase
{
    public CodigosRecuperacionLoginTests(CustomWebApplicationFactory factory) : base(factory) { }

    [Fact]
    public async Task Codigos_SeGuardanHasheados_NuncaEnTextoPlano()
    {
        var usuario = await CrearUsuarioAsync();
        var codigos = await HabilitarConCodigosAsync(usuario);

        codigos.Should().HaveCount(10).And.OnlyHaveUniqueItems();
        var guardado = await ValorGuardadoAsync(usuario.Id);
        guardado.Should().NotBeNullOrEmpty();
        guardado!.Split(';').Should().HaveCount(10);
        foreach (var codigo in codigos)
        {
            guardado.Should().NotContain(codigo);
            guardado.Should().NotContain(UserStoreCodigosRecuperacion.Normalizar(codigo));
        }
    }

    [Fact]
    public async Task CodigoDeRecuperacion_IniciaSesionUnaSolaVez_YQuedaAuditado()
    {
        var usuario = await CrearUsuarioAsync();
        var codigos = await HabilitarConCodigosAsync(usuario);

        // Lower case and without the dash: what a user types from a printed sheet.
        var tecleado = codigos[0].Replace("-", "").ToLowerInvariant();
        var ok = await VerificarConCodigoRecuperacionAsync(await DesafioAsync(usuario), tecleado);
        ok.StatusCode.Should().Be(HttpStatusCode.OK, await ok.Content.ReadAsStringAsync());
        var body = await ok.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("token").GetString().Should().NotBeNullOrEmpty();
        body.GetProperty("codigosRecuperacionRestantes").GetInt32().Should().Be(9);

        var repetido = await VerificarConCodigoRecuperacionAsync(await DesafioAsync(usuario), codigos[0]);
        repetido.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var estado = await NewClient(TokenDe(usuario)).GetFromJsonAsync<JsonElement>("/api/auth/2fa/estado");
        estado.GetProperty("codigosRecuperacionRestantes").GetInt32().Should().Be(9);

        var acciones = (await AuditoriaAsync(usuario.Id)).Select(a => a.Accion).ToList();
        acciones.Should().Contain("CodigoRecuperacionUsado").And.Contain("CodigoRecuperacionFallido");
    }
}

/// <summary>Activation hands out the codes; regeneration replaces them; deactivation removes them.</summary>
public class CodigosRecuperacionGestionTests : CodigosRecuperacionTestBase
{
    public CodigosRecuperacionGestionTests(CustomWebApplicationFactory factory) : base(factory) { }

    [Fact]
    public async Task Activar_DevuelveDiezCodigos_YDesactivar_LosBorra()
    {
        var usuario = await CrearUsuarioAsync();
        var cliente = NewClient(TokenDe(usuario));
        (await cliente.PostAsync("/api/auth/2fa/configurar", null)).EnsureSuccessStatusCode();

        var activar = await cliente.PostAsJsonAsync("/api/auth/2fa/activar", new { codigo = await CodigoTotpAsync(usuario.Id) });
        activar.StatusCode.Should().Be(HttpStatusCode.OK, await activar.Content.ReadAsStringAsync());
        var body = await activar.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("codigosRecuperacion").GetArrayLength().Should().Be(10);
        (await cliente.GetFromJsonAsync<JsonElement>("/api/auth/2fa/estado"))
            .GetProperty("codigosRecuperacionRestantes").GetInt32().Should().Be(10);

        var desactivar = await cliente.PostAsJsonAsync("/api/auth/2fa/desactivar", new { codigo = await CodigoTotpAsync(usuario.Id) });
        desactivar.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ValorGuardadoAsync(usuario.Id)).Should().BeNull();
    }

    [Fact]
    public async Task Regenerar_ExigeContrasenaOCodigo_YAnulaLosAnteriores()
    {
        var usuario = await CrearUsuarioAsync();
        var anteriores = await HabilitarConCodigosAsync(usuario);
        var cliente = NewClient(TokenDe(usuario));

        (await cliente.PostAsJsonAsync("/api/auth/2fa/codigos-recuperacion", new { }))
            .StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await cliente.PostAsJsonAsync("/api/auth/2fa/codigos-recuperacion", new { contrasena = "Incorrecta1" }))
            .StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var resp = await cliente.PostAsJsonAsync("/api/auth/2fa/codigos-recuperacion", new { contrasena = Contrasena });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var nuevos = (await resp.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("codigosRecuperacion").EnumerateArray().Select(e => e.GetString()!).ToList();
        nuevos.Should().HaveCount(10).And.NotIntersectWith(anteriores);

        var conCodigoTotp = await cliente.PostAsJsonAsync("/api/auth/2fa/codigos-recuperacion",
            new { codigo = await CodigoTotpAsync(usuario.Id) });
        conCodigoTotp.StatusCode.Should().Be(HttpStatusCode.OK);

        (await VerificarConCodigoRecuperacionAsync(await DesafioAsync(usuario), anteriores[0]))
            .StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var acciones = (await AuditoriaAsync(usuario.Id)).Select(a => a.Accion).ToList();
        acciones.Should().Contain("CodigosRecuperacionRegenerados").And.Contain("CodigosRecuperacionRegeneracionFallida");
    }

    [Fact]
    public async Task Regenerar_Sin2FA_Retorna400()
    {
        var usuario = await CrearUsuarioAsync();

        var resp = await NewClient(TokenDe(usuario))
            .PostAsJsonAsync("/api/auth/2fa/codigos-recuperacion", new { contrasena = Contrasena });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}

/// <summary>
/// An access token alone must not reset an active 2FA or mint recovery codes: configurar
/// and activar refuse while 2FA is on, and desactivar needs a current TOTP code.
/// </summary>
public class DosFactoresReautenticacionTests : CodigosRecuperacionTestBase
{
    public DosFactoresReautenticacionTests(CustomWebApplicationFactory factory) : base(factory) { }

    private async Task<string?> LlaveAsync(Guid usuarioId)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        return await um.GetAuthenticatorKeyAsync((await um.FindByIdAsync(usuarioId.ToString()))!);
    }

    [Fact]
    public async Task Configurar_Con2FAActivo_Retorna409_YNoCambiaLaLlave()
    {
        var usuario = await CrearUsuarioAsync();
        await HabilitarConCodigosAsync(usuario);
        var llaveAntes = await LlaveAsync(usuario.Id);

        var resp = await NewClient(TokenDe(usuario)).PostAsync("/api/auth/2fa/configurar", null);

        resp.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("mensaje").GetString()
            .Should().Contain("ya está activa");
        (await LlaveAsync(usuario.Id)).Should().Be(llaveAntes);
    }

    [Fact]
    public async Task Activar_Con2FAActivo_Retorna409_SinCodigosNuevos()
    {
        var usuario = await CrearUsuarioAsync();
        await HabilitarConCodigosAsync(usuario);
        var guardadoAntes = await ValorGuardadoAsync(usuario.Id);

        var resp = await NewClient(TokenDe(usuario))
            .PostAsJsonAsync("/api/auth/2fa/activar", new { codigo = await CodigoTotpAsync(usuario.Id) });

        resp.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.TryGetProperty("codigosRecuperacion", out _).Should().BeFalse();
        body.GetProperty("mensaje").GetString().Should().Contain("Generar códigos nuevos");
        (await ValorGuardadoAsync(usuario.Id)).Should().Be(guardadoAntes);
    }

    [Theory]
    [InlineData("")]
    [InlineData("000000")]
    public async Task Desactivar_SinCodigoTotpValido_NoDesactiva(string codigo)
    {
        var usuario = await CrearUsuarioAsync();
        await HabilitarConCodigosAsync(usuario);
        var cliente = NewClient(TokenDe(usuario));
        // Make sure the guess is not, by chance, the current code.
        if (codigo == await CodigoTotpAsync(usuario.Id)) codigo = "999999";

        var resp = await cliente.PostAsJsonAsync("/api/auth/2fa/desactivar", new { codigo });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await cliente.GetFromJsonAsync<JsonElement>("/api/auth/2fa/estado"))
            .GetProperty("habilitado").GetBoolean().Should().BeTrue();
    }

    [Theory]
    [InlineData(nameof(AppointVaAPI.Controllers.V1.AutenticacionController.Activar2FA), AppointVaAPI.Constants.Politicas.LimiteGestion2FA)]
    [InlineData(nameof(AppointVaAPI.Controllers.V1.AutenticacionController.Desactivar2FA), AppointVaAPI.Constants.Politicas.LimiteGestion2FA)]
    [InlineData(nameof(AppointVaAPI.Controllers.V1.AutenticacionController.Configurar2FA), "Auth")]
    public void Endpoints2FA_EstanLimitados(string accion, string politica)
    {
        typeof(AppointVaAPI.Controllers.V1.AutenticacionController).GetMethod(accion)!
            .GetCustomAttributes(typeof(Microsoft.AspNetCore.RateLimiting.EnableRateLimitingAttribute), inherit: true)
            .Cast<Microsoft.AspNetCore.RateLimiting.EnableRateLimitingAttribute>()
            .Should().ContainSingle().Which.PolicyName.Should().Be(politica);
    }
}
