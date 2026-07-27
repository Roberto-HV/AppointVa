using System.Net;
using FluentAssertions;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class PlanesControllerIntegrationTests : IntegrationTestBase
{
    public PlanesControllerIntegrationTests(CustomWebApplicationFactory factory)
        : base(factory) { }

    [Fact]
    public async Task Listar_SinToken_Retorna401()
    {
        ClearToken();

        var response = await Client.GetAsync("/api/planes");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Listar_ConPropietario_Retorna403()
    {
        SetToken(TestTokenHelper.Propietario());

        var response = await Client.GetAsync("/api/planes");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Listar_ConSuperAdmin_Retorna200()
    {
        SetToken(TestTokenHelper.SuperAdmin());

        var response = await Client.GetAsync("/api/planes");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
