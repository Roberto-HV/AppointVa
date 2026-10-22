using AppointVaAPI.Services.IServices;
using Hangfire.Dashboard;

namespace AppointVaAPI.Filters;

/// <summary>
/// Lets a request into the Hangfire dashboard only when it carries a live dashboard
/// session cookie. That session is created by /hangfire-session from a single-use
/// ticket that only a SuperAdmin can obtain (POST /api/admin/hangfire/ticket).
/// </summary>
public class HangfireAuthorizationFilter : IDashboardAuthorizationFilter
{
    public const string NombreCookie = "hangfire_session";

    public bool Authorize(DashboardContext context)
    {
        var http = context.GetHttpContext();
        var sesion = http.Request.Cookies[NombreCookie];
        var acceso = http.RequestServices.GetRequiredService<IPanelJobsAccesoService>();
        return acceso.SesionValida(sesion);
    }
}
