using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AppointVaAPI.Data;
using AppointVaAPI.Helpers;
using AppointVaAPI.Models;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class PlanesControllerIntegrationTests : IntegrationTestBase
{
    public PlanesControllerIntegrationTests(CustomWebApplicationFactory factory)
        : base(factory) { }

    [Fact]
    public async Task Listar_SinToken_Retorna401()
    {
        ClearToken();

        var response = await Client.GetAsync("/api/planes");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Listar_ConPropietario_Retorna403()
    {
        SetToken(TestTokenHelper.Propietario());

        var response = await Client.GetAsync("/api/planes");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Listar_ConSuperAdmin_Retorna200()
    {
        SetToken(TestTokenHelper.SuperAdmin());

        var response = await Client.GetAsync("/api/planes");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Listar_IndicaSiElPlanHabilitaElModuloDePagos_ConLaMismaReglaQueSetPlan()
    {
        var pro = Guid.NewGuid();
        var basico = Guid.NewGuid();
        await using (var scope = Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Planes.AddRange(
                new Plan { Id = pro, Nombre = "Pro", PrecioMensual = 449, MaxEmpleados = 4, MaxCitasMes = 500, Activo = 1 },
                new Plan { Id = basico, Nombre = "Basico", PrecioMensual = 249, MaxEmpleados = 2, MaxCitasMes = 200, Activo = 1 });
            await db.SaveChangesAsync();
        }
        SetToken(TestTokenHelper.SuperAdmin());

        var planes = (await Client.GetFromJsonAsync<List<JsonElement>>("/api/planes"))!
            .ToDictionary(p => p.GetProperty("id").GetGuid());

        planes[pro].GetProperty("habilitaModuloPagos").GetBoolean()
            .Should().Be(FacturacionAdmin.PlanHabilitaModuloPagos("Pro")).And.BeTrue();
        planes[basico].GetProperty("habilitaModuloPagos").GetBoolean().Should().BeFalse();
    }
}
