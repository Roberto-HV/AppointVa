using AppointVaAPI.Helpers;
using FluentAssertions;

namespace AppointVaAPI.Tests;

/// <summary>
/// Lote 2 (G3): the billing figures of the SuperAdmin console. A plan assigned is not money
/// coming in; only a current subscription of a paying business adds to the monthly income.
/// </summary>
public class FacturacionAdminTests
{
    private static readonly DateTime Hoy = new(2026, 11, 3);

    [Theory]
    [InlineData(null, FacturacionAdmin.SinSuscripcion)]
    [InlineData(30, FacturacionAdmin.Activa)]
    [InlineData(8, FacturacionAdmin.Activa)]
    [InlineData(7, FacturacionAdmin.PorVencer)]
    [InlineData(0, FacturacionAdmin.PorVencer)]
    [InlineData(-1, FacturacionAdmin.Vencida)]
    public void Estado_SegunDiasRestantes(int? dias, string esperado) =>
        FacturacionAdmin.Estado(dias).Should().Be(esperado);

    [Fact]
    public void DiasRestantes_IgnoraLaHora()
    {
        FacturacionAdmin.DiasRestantes(new DateTime(2026, 11, 10, 23, 0, 0), Hoy.AddHours(22)).Should().Be(7);
        FacturacionAdmin.DiasRestantes(null, Hoy).Should().BeNull();
    }

    [Fact]
    public void PrecioMensual_SumaLosEmpleadosExtra() =>
        FacturacionAdmin.PrecioMensual(449m, 2).Should().Be(549m);

    [Theory]
    [InlineData("Pro", true)]
    [InlineData("pro", true)]
    [InlineData("Basico", false)]
    [InlineData("Premium", false)]
    [InlineData(null, false)]
    public void PlanHabilitaModuloPagos_SoloLosPlanesPro(string? nombre, bool esperado) =>
        FacturacionAdmin.PlanHabilitaModuloPagos(nombre).Should().Be(esperado);

    [Fact]
    public void IngresoMensual_ConSuscripcionVigente_EsElPrecioMensual()
    {
        FacturacionAdmin.IngresoMensual(FacturacionAdmin.Activa, 30, esTester: false, 549m).Should().Be(549m);
        FacturacionAdmin.IngresoMensual(FacturacionAdmin.PorVencer, 3, esTester: false, 549m).Should().Be(549m);
    }

    [Fact]
    public void IngresoMensual_ConPlanPeroSinPago_EsCero() =>
        FacturacionAdmin.IngresoMensual(FacturacionAdmin.SinSuscripcion, null, esTester: false, 449m).Should().Be(0m);

    [Fact]
    public void IngresoMensual_Vencida_EsCero() =>
        FacturacionAdmin.IngresoMensual(FacturacionAdmin.Vencida, -5, esTester: false, 449m).Should().Be(0m);

    [Fact]
    public void IngresoMensual_Tester_EsCero() =>
        FacturacionAdmin.IngresoMensual(FacturacionAdmin.Activa, 30, esTester: true, 449m).Should().Be(0m);

    [Fact]
    public void IngresoMensual_DePorVida_EsCero()
    {
        var dias = FacturacionAdmin.DiasAccesoPermanente + 10;
        FacturacionAdmin.EsAccesoPermanente(dias).Should().BeTrue();
        FacturacionAdmin.EsVigente(FacturacionAdmin.Estado(dias)).Should().BeTrue();
        FacturacionAdmin.IngresoMensual(FacturacionAdmin.Estado(dias), dias, esTester: false, 449m).Should().Be(0m);
    }

    // ── Lote 5 (G1): step-up for permanent access, judged on the resulting due date ──

    [Fact]
    public void Umbrales_SalenDeUnaSolaCifra()
    {
        FacturacionAdmin.DiasAccesoPermanente.Should().Be(365 * FacturacionAdmin.AnosAccesoPermanente);
        FacturacionAdmin.MesesAccesoPermanente.Should().Be(12 * FacturacionAdmin.AnosAccesoPermanente);
    }

    [Fact]
    public void RequiereReautenticacion_DePorVida_Siempre() =>
        FacturacionAdmin.RequiereReautenticacion(1200, null, Hoy.AddMonths(1200), Hoy).Should().BeTrue();

    [Fact]
    public void RequiereReautenticacion_PagoMensual_No() =>
        FacturacionAdmin.RequiereReautenticacion(1, Hoy.AddDays(10), Hoy.AddDays(10).AddMonths(1), Hoy).Should().BeFalse();

    [Fact]
    public void RequiereReautenticacion_PagosAcumulados_QueLleganAlUmbral_Si()
    {
        // 599 months alone are not "lifetime", but on top of an earlier 599 they are.
        FacturacionAdmin.EsPagoDeAccesoPermanente(599).Should().BeFalse();
        var tras599 = Hoy.AddMonths(599).AddDays(-1);
        FacturacionAdmin.RequiereReautenticacion(599, null, tras599, Hoy).Should().BeFalse();
        FacturacionAdmin.RequiereReautenticacion(599, tras599, tras599.AddMonths(599), Hoy).Should().BeTrue();
    }

    [Fact]
    public void RequiereReautenticacion_SinExtenderElVencimiento_No()
    {
        var permanente = Hoy.AddMonths(1200);
        // Amount/notes edit (same due date) or shortening never grants access.
        FacturacionAdmin.RequiereReautenticacion(0, permanente, permanente, Hoy).Should().BeFalse();
        FacturacionAdmin.RequiereReautenticacion(0, permanente, permanente.AddYears(-1), Hoy).Should().BeFalse();
        FacturacionAdmin.RequiereReautenticacion(0, permanente, permanente.AddDays(1), Hoy).Should().BeTrue();
    }
}
