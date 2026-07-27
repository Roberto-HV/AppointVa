using System.Net;
using FluentAssertions;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class IntakeControllerIntegrationTests : IntegrationTestBase
{
    public IntakeControllerIntegrationTests(CustomWebApplicationFactory factory)
        : base(factory) { }

    [Fact]
    public async Task Campos_SinToken_Retorna401()
    {
        ClearToken();

        var response = await Client.GetAsync("/api/intake/campos");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Campos_ConEmpleado_Retorna403()
    {
        SetToken(TestTokenHelper.Empleado());

        var response = await Client.GetAsync("/api/intake/campos");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Campos_ConPropietario_PasaGateDeAuth()
    {
        SetToken(TestTokenHelper.Propietario());

        var response = await Client.GetAsync("/api/intake/campos");

        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task PublicoCampos_SinToken_PasaGateDeAuth()
    {
        ClearToken();

        var response = await Client.GetAsync("/api/publico/intake/test-negocio");

        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
    }
}
