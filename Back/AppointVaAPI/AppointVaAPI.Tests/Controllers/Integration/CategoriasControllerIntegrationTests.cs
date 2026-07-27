using System.Net;
using System.Text;
using FluentAssertions;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class CategoriasControllerIntegrationTests : IntegrationTestBase
{
    public CategoriasControllerIntegrationTests(CustomWebApplicationFactory factory)
        : base(factory) { }

    [Fact]
    public async Task Listar_SinToken_Retorna401()
    {
        ClearToken();

        var response = await Client.GetAsync("/api/categorias");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Listar_ConEmpleado_Retorna200()
    {
        SetToken(TestTokenHelper.Empleado());

        var response = await Client.GetAsync("/api/categorias");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Crear_ConEmpleado_Retorna403()
    {
        SetToken(TestTokenHelper.Empleado());
        var body = new StringContent(
            """{"nombre":"Cat Test"}""",
            Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/categorias", body);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Crear_ConPropietario_PasaGateDeAuth()
    {
        SetToken(TestTokenHelper.Propietario());
        var body = new StringContent(
            """{"nombre":"Cat Test"}""",
            Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/categorias", body);

        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
    }
}
