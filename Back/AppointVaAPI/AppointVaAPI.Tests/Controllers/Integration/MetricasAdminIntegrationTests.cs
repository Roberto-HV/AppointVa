using System.Net;
using FluentAssertions;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>
/// Integration tests for MetricasAdminController HTTP pipeline.
/// Unit tests (business logic) live in Controllers/MetricasAdminControllerTests.cs.
/// </summary>
public class MetricasAdminIntegrationTests : IntegrationTestBase
{
    public MetricasAdminIntegrationTests(CustomWebApplicationFactory factory)
        : base(factory) { }

    [Fact]
    public async Task NegociosMetricas_SinToken_Retorna401()
    {
        ClearToken();

        var response = await Client.GetAsync("/api/admin/metricas/negocios");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task NegociosMetricas_ConPropietario_Retorna403()
    {
        SetToken(TestTokenHelper.Propietario());

        var response = await Client.GetAsync("/api/admin/metricas/negocios");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task NegociosMetricas_ConSuperAdmin_Retorna200()
    {
        SetToken(TestTokenHelper.SuperAdmin());

        var response = await Client.GetAsync("/api/admin/metricas/negocios");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
