using System.Net;
using FluentAssertions;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class DashboardControllerIntegrationTests : IntegrationTestBase
{
    public DashboardControllerIntegrationTests(CustomWebApplicationFactory factory)
        : base(factory) { }

    [Fact]
    public async Task Resumen_SinToken_Retorna401()
    {
        ClearToken();

        var response = await Client.GetAsync("/api/dashboard/resumen");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Resumen_ConSuperAdmin_Retorna403()
    {
        SetToken(TestTokenHelper.SuperAdmin());

        var response = await Client.GetAsync("/api/dashboard/resumen");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Resumen_ConPropietario_PasaGateDeAuth()
    {
        SetToken(TestTokenHelper.Propietario());

        var response = await Client.GetAsync("/api/dashboard/resumen");

        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Resumen_ConEmpleado_PasaGateDeAuth()
    {
        SetToken(TestTokenHelper.Empleado());

        var response = await Client.GetAsync("/api/dashboard/resumen");

        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Tendencia_ConEmpleado_Retorna403()
    {
        SetToken(TestTokenHelper.Empleado());

        var response = await Client.GetAsync("/api/dashboard/tendencia");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
