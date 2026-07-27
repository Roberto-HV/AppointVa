using System.Net;
using FluentAssertions;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class MeControllerIntegrationTests : IntegrationTestBase
{
    public MeControllerIntegrationTests(CustomWebApplicationFactory factory)
        : base(factory) { }

    [Fact]
    public async Task PushStatus_SinToken_Retorna401()
    {
        ClearToken();

        var response = await Client.GetAsync("/api/me/push-status");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task PushStatus_ConSuperAdmin_Retorna403()
    {
        SetToken(TestTokenHelper.SuperAdmin());

        var response = await Client.GetAsync("/api/me/push-status");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task PushStatus_ConPropietario_PasaGateDeAuth()
    {
        SetToken(TestTokenHelper.Propietario());

        var response = await Client.GetAsync("/api/me/push-status");

        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task VapidKey_SinToken_Retorna200()
    {
        ClearToken();

        var response = await Client.GetAsync("/api/me/push-vapid-key");

        // AllowAnonymous — the endpoint responds (200 or 404 if key not configured, never 401)
        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
    }
}
