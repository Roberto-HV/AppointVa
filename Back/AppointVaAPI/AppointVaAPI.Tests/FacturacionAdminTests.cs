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
}
