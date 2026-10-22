using Hangfire;

namespace AppointVaAPI.Filters;

/// <summary>
/// Options for the /hangfire dashboard, kept out of Program.cs so a test can pin them:
/// the Testing host never maps the dashboard.
/// </summary>
public static class HangfireDashboardOpciones
{
    public static DashboardOptions Crear() => new()
    {
        // Empty sync list: the default would add LocalRequestsOnlyAuthorizationFilter.
        Authorization = [],
        AsyncAuthorization = [new HangfireAuthorizationFilter()],
        DashboardTitle = "AppointVa — Jobs",
        IsReadOnlyFunc = _ => false,
    };
}
