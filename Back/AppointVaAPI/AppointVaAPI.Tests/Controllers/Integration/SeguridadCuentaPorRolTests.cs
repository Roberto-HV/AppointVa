using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AppointVaAPI.Constants;
using AppointVaAPI.Models;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>
/// Lote 1 (G1): the SuperAdmin can set up 2FA and change their own password from /admin/cuenta,
/// and the same endpoints keep working for the business roles.
/// </summary>
public class SeguridadCuentaPorRolTests : CodigosRecuperacionTestBase
{
    public SeguridadCuentaPorRolTests(CustomWebApplicationFactory factory) : base(factory) { }

    private async Task<ApplicationUser> CrearConRolAsync(string rol)
    {
        Guid? negocioId = null;
        if (rol != Roles.SuperAdmin)
        {
            negocioId = Guid.NewGuid();
            await Factory.SeedNegocioAsync(negocioId.Value);
        }
        await using var scope = Factory.Services.CreateAsyncScope();
        var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var email = $"{rol.ToLowerInvariant()}-{Guid.NewGuid():N}@ejemplo.com";
        var u = new ApplicationUser
        {
            Id = Guid.NewGuid(), UserName = email, Email = email, EmailConfirmed = true,
            Nombre = "Cuenta", Apellido = rol, Activo = true, NegocioId = negocioId, FechaCreacion = DateTime.UtcNow
        };
        (await um.CreateAsync(u, Contrasena)).Succeeded.Should().BeTrue();
        (await um.AddToRoleAsync(u, rol)).Succeeded.Should().BeTrue();
        return u;
    }

    private HttpClient ClienteDe(ApplicationUser u, string rol) =>
        NewClient(TestTokenHelper.GenerarToken(rol, u.NegocioId, u.Id));

    [Theory]
    [InlineData(Roles.SuperAdmin)]
    [InlineData(Roles.Propietario)]
    [InlineData(Roles.Empleado)]
    public async Task ConfigurarYActivar2FA_FuncionaParaElRol(string rol)
    {
        var usuario = await CrearConRolAsync(rol);
        var cliente = ClienteDe(usuario, rol);

        var configurar = await cliente.PostAsync("/api/auth/2fa/configurar", null);
        configurar.StatusCode.Should().Be(HttpStatusCode.OK, await configurar.Content.ReadAsStringAsync());
        (await configurar.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("uri").GetString()
            .Should().StartWith("otpauth://totp/AppointVa:");

        var activar = await cliente.PostAsJsonAsync("/api/auth/2fa/activar", new { codigo = await CodigoTotpAsync(usuario.Id) });
        activar.StatusCode.Should().Be(HttpStatusCode.OK, await activar.Content.ReadAsStringAsync());

        (await cliente.GetFromJsonAsync<JsonElement>("/api/auth/2fa/estado"))
            .GetProperty("habilitado").GetBoolean().Should().BeTrue();
        (await AuditoriaAsync(usuario.Id)).Select(a => a.Accion).Should().Contain(AccionesAuditoria.DosFactoresActivado);
    }

    [Theory]
    [InlineData(Roles.SuperAdmin)]
    [InlineData(Roles.Propietario)]
    [InlineData(Roles.Empleado)]
    public async Task CambiarPassword_FuncionaParaElRol_YQuedaAuditado(string rol)
    {
        var usuario = await CrearConRolAsync(rol);

        var resp = await ClienteDe(usuario, rol).PostAsJsonAsync("/api/auth/cambiar-password",
            new { passwordActual = Contrasena, passwordNuevo = "Nueva-Clave-2026" });

        resp.StatusCode.Should().Be(HttpStatusCode.OK, await resp.Content.ReadAsStringAsync());
        await using var scope = Factory.Services.CreateAsyncScope();
        var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var u = (await um.FindByIdAsync(usuario.Id.ToString()))!;
        (await um.CheckPasswordAsync(u, "Nueva-Clave-2026")).Should().BeTrue();
        var entradas = await AuditoriaAsync(usuario.Id);
        entradas.Select(a => a.Accion).Should().Contain(AccionesAuditoria.CambiarPassword);
        entradas.Should().OnlyContain(a => a.Detalles == null || !a.Detalles.Contains("Nueva-Clave-2026"));
    }

    [Fact]
    public async Task CambiarPassword_ConLaActualIncorrecta_NoCambiaNada()
    {
        var admin = await CrearConRolAsync(Roles.SuperAdmin);

        var resp = await ClienteDe(admin, Roles.SuperAdmin).PostAsJsonAsync("/api/auth/cambiar-password",
            new { passwordActual = "NoEsLaMia-1", passwordNuevo = "Nueva-Clave-2026" });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await AuditoriaAsync(admin.Id)).Select(a => a.Accion).Should().NotContain(AccionesAuditoria.CambiarPassword);
    }
}
