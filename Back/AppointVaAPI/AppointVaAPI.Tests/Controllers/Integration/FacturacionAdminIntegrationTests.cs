using System.Net;
using System.Net.Http.Json;
using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Admin;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>
/// Lote 2 (G3): GET /api/admin/suscripciones gives each row the list price of its plan and,
/// separately, what it adds to the monthly income. The console's footer and KPIs add up
/// <c>IngresoMensual</c>, so for the same data the rows and the totals agree.
/// </summary>
public class FacturacionAdminIntegrationTests : IntegrationTestBase
{
    public FacturacionAdminIntegrationTests(CustomWebApplicationFactory factory) : base(factory) { }

    private async Task<Guid> CrearAdminAsync()
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var email = $"admin-{Guid.NewGuid():N}@ejemplo.com";
        var admin = new ApplicationUser
        {
            Id = Guid.NewGuid(), UserName = email, Email = email, EmailConfirmed = true,
            Nombre = "Admin", Apellido = "Plataforma", Activo = true, FechaCreacion = DateTime.UtcNow
        };
        (await um.CreateAsync(admin, "Admin-Clave-123")).Succeeded.Should().BeTrue();
        (await um.AddToRoleAsync(admin, Roles.SuperAdmin)).Succeeded.Should().BeTrue();
        return admin.Id;
    }

    private async Task<Guid> CrearNegocioAsync(Guid planId, DateTime? vence, bool tester = false, int extra = 0)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var negocio = new Negocio
        {
            Id = Guid.NewGuid(),
            Nombre = $"Fact {Guid.NewGuid():N}"[..14],
            Slug = $"fact-{Guid.NewGuid():N}"[..14],
            Activo = 1,
            Sector = "belleza",
            PlanId = planId,
            FechaVencimiento = vence,
            EsTester = tester,
            EmpleadosExtra = extra,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow
        };
        db.Negocios.Add(negocio);
        await db.SaveChangesAsync();
        return negocio.Id;
    }

    private async Task<Guid> CrearPlanAsync()
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var plan = new Plan { Id = Guid.NewGuid(), Nombre = "Pro", PrecioMensual = 449, MaxEmpleados = 4, MaxCitasMes = 500, Activo = 1 };
        db.Planes.Add(plan);
        await db.SaveChangesAsync();
        return plan.Id;
    }

    private async Task<Dictionary<Guid, SuscripcionResumenDto>> FilasAsync(HttpClient cliente, IEnumerable<Guid> ids)
    {
        var filas = await cliente.GetFromJsonAsync<List<SuscripcionResumenDto>>("/api/admin/suscripciones");
        var mias = ids.ToHashSet();
        return filas!.Where(f => mias.Contains(f.NegocioId)).ToDictionary(f => f.NegocioId);
    }

    [Fact]
    public async Task Suscripciones_SeparaPrecioDelPlanDeIngresoMensual_YLosTotalesCuadran()
    {
        var adminId = await CrearAdminAsync();
        var cliente = NewClient(TestTokenHelper.GenerarToken(Roles.SuperAdmin, userId: adminId));
        var plan = await CrearPlanAsync();
        var hoy = DateTime.UtcNow.Date;

        var sinPago = await CrearNegocioAsync(plan, vence: null);
        var activa = await CrearNegocioAsync(plan, vence: hoy.AddDays(30), extra: 2);
        var porVencer = await CrearNegocioAsync(plan, vence: hoy.AddDays(3));
        var vencida = await CrearNegocioAsync(plan, vence: hoy.AddDays(-2));
        var tester = await CrearNegocioAsync(plan, vence: hoy.AddDays(30), tester: true);
        var porVida = await CrearNegocioAsync(plan, vence: hoy.AddMonths(1200));
        var ids = new[] { sinPago, activa, porVencer, vencida, tester, porVida };

        var filas = await FilasAsync(cliente, ids);
        filas.Should().HaveCount(ids.Length);

        // The list price is shown for every row with a plan, paid or not...
        filas[sinPago].TotalMensual.Should().Be(449m);
        filas[activa].TotalMensual.Should().Be(549m);

        // ...but only current, paying subscriptions bring money in.
        filas[sinPago].SuscripcionVigente.Should().BeFalse();
        filas[sinPago].IngresoMensual.Should().Be(0m);
        filas[activa].IngresoMensual.Should().Be(549m);
        filas[porVencer].IngresoMensual.Should().Be(449m);
        filas[vencida].IngresoMensual.Should().Be(0m);
        filas[tester].EsTester.Should().BeTrue();
        filas[tester].IngresoMensual.Should().Be(0m);
        filas[porVida].AccesoPermanente.Should().BeTrue();
        filas[porVida].SuscripcionVigente.Should().BeTrue();
        filas[porVida].IngresoMensual.Should().Be(0m);

        // The footer/KPI total is the sum of the rows' income.
        filas.Values.Sum(f => f.IngresoMensual).Should().Be(549m + 449m);

        // Recording a payment for the business without one moves it into the income.
        var pago = await cliente.PostAsJsonAsync($"/api/admin/negocios/{sinPago}/pagos",
            new RegistrarPagoDto { MesesPagados = 1, Monto = 449m });
        pago.StatusCode.Should().Be(HttpStatusCode.OK);

        filas = await FilasAsync(cliente, ids);
        filas[sinPago].SuscripcionVigente.Should().BeTrue();
        filas[sinPago].IngresoMensual.Should().Be(449m);
        filas.Values.Sum(f => f.IngresoMensual).Should().Be(549m + 449m + 449m);
    }
}
