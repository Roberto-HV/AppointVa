using System.Net;
using System.Text;
using FluentAssertions;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class ServiciosControllerIntegrationTests : IntegrationTestBase
{
    public ServiciosControllerIntegrationTests(CustomWebApplicationFactory factory)
        : base(factory) { }

    [Fact]
    public async Task Listar_SinToken_Retorna401()
    {
        ClearToken();

        var response = await Client.GetAsync("/api/servicios");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Listar_ConEmpleado_Retorna200()
    {
        SetToken(TestTokenHelper.Empleado());

        var response = await Client.GetAsync("/api/servicios");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Crear_ConEmpleado_Retorna403()
    {
        SetToken(TestTokenHelper.Empleado());
        var body = new StringContent(
            """{"nombre":"x","duracionMinutos":30,"precio":100,"orden":1}""",
            Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/servicios", body);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Crear_ConPropietario_PasaGateDeAuth()
    {
        SetToken(TestTokenHelper.Propietario());
        var body = new StringContent(
            """{"nombre":"x","duracionMinutos":30,"precio":100,"orden":1}""",
            Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/servicios", body);

        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
    }
}
