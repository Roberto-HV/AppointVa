using System.Net;
using System.Net.Http.Json;
using FluentAssertions;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class SuscripcionAdminControllerIntegrationTests : IntegrationTestBase
{
    public SuscripcionAdminControllerIntegrationTests(CustomWebApplicationFactory factory)
        : base(factory) { }

    [Fact]
    public async Task Listar_SinToken_Retorna401()
    {
        ClearToken();

        var response = await Client.GetAsync("/api/admin/suscripciones");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Listar_ConPropietario_Retorna403()
    {
        SetToken(TestTokenHelper.Propietario());

        var response = await Client.GetAsync("/api/admin/suscripciones");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Listar_ConSuperAdmin_Retorna200()
    {
        SetToken(TestTokenHelper.SuperAdmin());

        var response = await Client.GetAsync("/api/admin/suscripciones");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task SetEmpleadosExtra_SinToken_Returns401()
    {
        ClearToken();
        var response = await Client.PatchAsJsonAsync(
            $"/api/admin/negocios/{Guid.NewGuid()}/empleados-extra",
            new { EmpleadosExtra = 2 });
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task SetEmpleadosExtra_ConTokenPropietario_Returns403()
    {
        SetToken(TestTokenHelper.Propietario());
        var response = await Client.PatchAsJsonAsync(
            $"/api/admin/negocios/{Guid.NewGuid()}/empleados-extra",
            new { EmpleadosExtra = 2 });
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task SetEmpleadosExtra_ConTokenSuperAdmin_IdInexistente_Returns404()
    {
        SetToken(TestTokenHelper.SuperAdmin());
        var response = await Client.PatchAsJsonAsync(
            $"/api/admin/negocios/{Guid.NewGuid()}/empleados-extra",
            new { EmpleadosExtra = 2 });
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SetEmpleadosExtra_ConTokenSuperAdmin_ValorNegativo_Returns400()
    {
        SetToken(TestTokenHelper.SuperAdmin());
        var response = await Client.PatchAsJsonAsync(
            $"/api/admin/negocios/{Guid.NewGuid()}/empleados-extra",
            new { EmpleadosExtra = -1 });
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
