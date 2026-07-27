using System.Net;
using FluentAssertions;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class ReportesControllerIntegrationTests : IntegrationTestBase
{
    public ReportesControllerIntegrationTests(CustomWebApplicationFactory factory)
        : base(factory) { }

    [Fact]
    public async Task Citas_SinToken_Retorna401()
    {
        ClearToken();

        var response = await Client.GetAsync("/api/reportes/citas?desde=2026-01-01&hasta=2026-12-31");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Citas_ConEmpleado_Retorna403()
    {
        SetToken(TestTokenHelper.Empleado());

        var response = await Client.GetAsync("/api/reportes/citas?desde=2026-01-01&hasta=2026-12-31");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Citas_ConPropietario_PasaGateDeAuth()
    {
        SetToken(TestTokenHelper.Propietario());

        var response = await Client.GetAsync("/api/reportes/citas?desde=2026-01-01&hasta=2026-12-31");

        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ExportarCsv_ConPropietario_PasaGateDeAuth()
    {
        SetToken(TestTokenHelper.Propietario());

        var response = await Client.GetAsync("/api/reportes/citas/exportar?desde=2026-01-01&hasta=2026-12-31");

        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
    }
}
