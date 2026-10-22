using System.Net;
using System.Net.Http.Json;
using AppointVaAPI.Constants;
using AppointVaAPI.Filters;
using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>
/// Dashboard-session hardening: the user behind a session is re-checked against Identity,
/// and logout drops that user's dashboard sessions and pending tickets.
/// </summary>
public class PanelJobsAccesoIntegrationTests : IntegrationTestBase
{
    public PanelJobsAccesoIntegrationTests(CustomWebApplicationFactory factory)
        : base(factory) { }

    private async Task<ApplicationUser> CrearSuperAdminAsync()
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        if (!await roles.RoleExistsAsync(Roles.SuperAdmin))
            await roles.CreateAsync(new IdentityRole<Guid>(Roles.SuperAdmin));

        var usuarios = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var email = $"sa-{Guid.NewGuid():N}@test.com";
        var usuario = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            Activo = true,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        };
        (await usuarios.CreateAsync(usuario)).Succeeded.Should().BeTrue();
        (await usuarios.AddToRoleAsync(usuario, Roles.SuperAdmin)).Succeeded.Should().BeTrue();
        return usuario;
    }

    private async Task<bool> AutorizadoAsync(Guid usuarioId)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var usuarios = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        return await HangfireAuthorizationFilter.UsuarioAutorizadoAsync(usuarios, usuarioId);
    }

    private async Task ModificarAsync(Guid usuarioId, Func<UserManager<ApplicationUser>, ApplicationUser, Task> cambio)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var usuarios = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var usuario = await usuarios.FindByIdAsync(usuarioId.ToString());
        await cambio(usuarios, usuario!);
    }

    [Fact]
    public async Task SuperAdminActivo_EstaAutorizado()
    {
        var usuario = await CrearSuperAdminAsync();

        (await AutorizadoAsync(usuario.Id)).Should().BeTrue();
    }

    [Fact]
    public async Task UsuarioInexistente_NoEstaAutorizado()
    {
        (await AutorizadoAsync(Guid.NewGuid())).Should().BeFalse();
    }

    [Fact]
    public async Task UsuarioDegradado_PierdeAcceso()
    {
        var usuario = await CrearSuperAdminAsync();

        await ModificarAsync(usuario.Id, (um, u) => um.RemoveFromRoleAsync(u, Roles.SuperAdmin));

        (await AutorizadoAsync(usuario.Id)).Should().BeFalse();
    }

    [Fact]
    public async Task UsuarioDesactivado_PierdeAcceso()
    {
        var usuario = await CrearSuperAdminAsync();

        await ModificarAsync(usuario.Id, (um, u) => { u.Activo = false; return um.UpdateAsync(u); });

        (await AutorizadoAsync(usuario.Id)).Should().BeFalse();
    }

    [Fact]
    public async Task UsuarioBloqueado_PierdeAcceso()
    {
        var usuario = await CrearSuperAdminAsync();

        await ModificarAsync(usuario.Id, async (um, u) =>
        {
            await um.SetLockoutEnabledAsync(u, true);
            await um.SetLockoutEndDateAsync(u, DateTimeOffset.UtcNow.AddHours(1));
        });

        (await AutorizadoAsync(usuario.Id)).Should().BeFalse();
    }

    [Fact]
    public async Task Logout_PurgaSesionesYTicketsDelUsuario()
    {
        var usuarioId = Guid.NewGuid();
        var otroId = Guid.NewGuid();
        var acceso = Factory.Services.GetRequiredService<IPanelJobsAccesoService>();
        var sesion = acceso.CanjearTicket(acceso.EmitirTicket(usuarioId));
        var ticketPendiente = acceso.EmitirTicket(usuarioId);
        var sesionOtro = acceso.CanjearTicket(acceso.EmitirTicket(otroId));
        Func<Guid, Task<bool>> siempre = _ => Task.FromResult(true);
        (await acceso.SesionValidaAsync(sesion, siempre)).Should().BeTrue();

        var client = NewClient(TestTokenHelper.GenerarToken(Roles.SuperAdmin, userId: usuarioId));
        var response = await client.PostAsJsonAsync("/api/auth/logout", new { refreshToken = "no-existe" });

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await acceso.SesionValidaAsync(sesion, siempre)).Should().BeFalse();
        acceso.CanjearTicket(ticketPendiente).Should().BeNull();
        (await acceso.SesionValidaAsync(sesionOtro, siempre)).Should().BeTrue();
    }
}
