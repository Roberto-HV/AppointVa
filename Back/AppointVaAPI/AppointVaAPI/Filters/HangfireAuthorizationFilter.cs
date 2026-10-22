using AppointVaAPI.Constants;
using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;
using Hangfire.Dashboard;
using Microsoft.AspNetCore.Identity;

namespace AppointVaAPI.Filters;

/// <summary>
/// Lets a request into the Hangfire dashboard only when it carries a live dashboard
/// session cookie. That session is created by /hangfire-session from a single-use
/// ticket that only a SuperAdmin can obtain (POST /api/admin/hangfire/ticket).
/// The session's user is re-checked (exists, active, not locked out, still SuperAdmin)
/// at most once per IPanelJobsAccesoService.IntervaloReverificacion, because the
/// dashboard polls /hangfire/stats every few seconds.
/// </summary>
public class HangfireAuthorizationFilter : IDashboardAsyncAuthorizationFilter
{
    public const string NombreCookie = "hangfire_session";

    public Task<bool> AuthorizeAsync(DashboardContext context)
    {
        var http = context.GetHttpContext();
        var sesion = http.Request.Cookies[NombreCookie];
        var acceso = http.RequestServices.GetRequiredService<IPanelJobsAccesoService>();
        var usuarios = http.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
        return acceso.SesionValidaAsync(sesion, id => UsuarioAutorizadoAsync(usuarios, id));
    }

    public static async Task<bool> UsuarioAutorizadoAsync(UserManager<ApplicationUser> usuarios, Guid usuarioId)
    {
        var usuario = await usuarios.FindByIdAsync(usuarioId.ToString());
        if (usuario is null || !usuario.Activo) return false;
        if (await usuarios.IsLockedOutAsync(usuario)) return false;
        return await usuarios.IsInRoleAsync(usuario, Roles.SuperAdmin);
    }
}
