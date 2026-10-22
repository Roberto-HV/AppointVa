using AppointVaAPI.Filters;
using FluentAssertions;

namespace AppointVaAPI.Tests;

/// <summary>
/// The Testing host never maps /hangfire, so the options Program.cs passes to
/// UseHangfireDashboard are pinned here: only the async session-cookie filter guards it.
/// </summary>
public class HangfireDashboardOpcionesTests
{
    [Fact]
    public void Crear_SoloUsaElFiltroAsincronoDeSesion()
    {
        var opciones = HangfireDashboardOpciones.Crear();

        opciones.Authorization.Should().BeEmpty(
            "the default sync list holds LocalRequestsOnlyAuthorizationFilter");
        opciones.AsyncAuthorization.Should().ContainSingle()
            .Which.Should().BeOfType<HangfireAuthorizationFilter>();
    }
}
