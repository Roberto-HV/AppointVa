using System.Net;
using FluentAssertions;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class NegociosControllerIntegrationTests : IntegrationTestBase
{
    public NegociosControllerIntegrationTests(CustomWebApplicationFactory factory)
        : base(factory) { }

    [Fact]
    public async Task Perfil_SinToken_Retorna401()
    {
        ClearToken();

        var response = await Client.GetAsync("/api/negocios/perfil");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Perfil_ConSuperAdmin_Retorna403()
    {
        SetToken(TestTokenHelper.SuperAdmin());

        var response = await Client.GetAsync("/api/negocios/perfil");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Perfil_ConPropietario_PasaGateDeAuth()
    {
        SetToken(TestTokenHelper.Propietario());

        var response = await Client.GetAsync("/api/negocios/perfil");

        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ListarTodos_ConPropietario_Retorna403()
    {
        SetToken(TestTokenHelper.Propietario());

        var response = await Client.GetAsync("/api/negocios");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ListarTodos_ConSuperAdmin_Retorna200()
    {
        SetToken(TestTokenHelper.SuperAdmin());

        var response = await Client.GetAsync("/api/negocios");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
