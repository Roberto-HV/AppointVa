using System.Net;
using System.Text;
using FluentAssertions;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>
/// Integration tests for PublicoController HTTP pipeline.
/// Unit tests (business logic) live in Controllers/PublicoController*Tests.cs.
/// </summary>
public class PublicoControllerIntegrationTests : IntegrationTestBase
{
    public PublicoControllerIntegrationTests(CustomWebApplicationFactory factory)
        : base(factory) { }

    [Fact]
    public async Task ObtenerNegocio_SlugInexistente_Retorna404()
    {
        ClearToken();

        var response = await Client.GetAsync("/api/publico/negocios/slug-que-no-existe");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task MisCitas_SlugInexistente_NoRequiereAuth()
    {
        ClearToken();

        var response = await Client.GetAsync("/api/publico/mis-citas?slug=x&email=x@x.com");

        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CrearCita_PayloadVacio_Retorna400()
    {
        ClearToken();
        var body = new StringContent("{}", Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/publico/citas", body);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Disponibilidad_SinParams_Retorna400()
    {
        ClearToken();

        var response = await Client.GetAsync("/api/publico/disponibilidad");

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
