using System.Net;
using FluentAssertions;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class DescuentosControllerIntegrationTests : IntegrationTestBase
{
    public DescuentosControllerIntegrationTests(CustomWebApplicationFactory factory)
        : base(factory) { }

    [Fact]
    public async Task Listar_SinToken_Retorna401()
    {
        ClearToken();

        var response = await Client.GetAsync("/api/descuentos");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Listar_ConEmpleado_Retorna403()
    {
        SetToken(TestTokenHelper.Empleado());

        var response = await Client.GetAsync("/api/descuentos");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Listar_ConPropietario_PasaGateDeAuth()
    {
        SetToken(TestTokenHelper.Propietario());

        var response = await Client.GetAsync("/api/descuentos");

        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ValidarPublico_SinToken_PasaGateDeAuth()
    {
        ClearToken();

        var response = await Client.GetAsync("/api/publico/descuentos/validar?codigo=TEST&slug=test");

        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
    }
}
