using System.Net;
using FluentAssertions;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class ListaEsperaControllerIntegrationTests : IntegrationTestBase
{
    public ListaEsperaControllerIntegrationTests(CustomWebApplicationFactory factory)
        : base(factory) { }

    [Fact]
    public async Task Listar_SinToken_Retorna401()
    {
        ClearToken();

        var response = await Client.GetAsync("/api/lista-espera");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Listar_ConEmpleado_Retorna403()
    {
        SetToken(TestTokenHelper.Empleado());

        var response = await Client.GetAsync("/api/lista-espera");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Listar_ConPropietario_PasaGateDeAuth()
    {
        SetToken(TestTokenHelper.Propietario());

        var response = await Client.GetAsync("/api/lista-espera");

        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
    }
}
