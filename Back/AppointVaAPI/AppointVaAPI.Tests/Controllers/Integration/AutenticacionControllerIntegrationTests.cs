using System.Net;
using System.Net.Http.Json;
using System.Text;
using FluentAssertions;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class AutenticacionControllerIntegrationTests : IntegrationTestBase
{
    public AutenticacionControllerIntegrationTests(CustomWebApplicationFactory factory)
        : base(factory) { }

    [Fact]
    public async Task Login_ConCredencialesInvalidas_Retorna400OUnauthorized()
    {
        var body = new StringContent("""{"email":"x@x.com","password":"x"}""", Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/auth/login", body);

        response.StatusCode.Should().BeOneOf(HttpStatusCode.BadRequest, HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Me_SinToken_Retorna401()
    {
        ClearToken();

        var response = await Client.GetAsync("/api/auth/me");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Me_ConTokenValido_PasaGateDeAuth()
    {
        SetToken(TestTokenHelper.Propietario());

        var response = await Client.GetAsync("/api/auth/me");

        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task RecuperarPassword_SinBody_Retorna400()
    {
        var body = new StringContent("{}", Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/auth/recuperar-contrasena", body);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
