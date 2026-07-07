using FluentAssertions;

namespace AppointVaAPI.Tests;

/// <summary>
/// Verifica la lógica de validación del límite mensual de citas por plan.
/// Replica exactamente la lógica de CitasController y PublicoController.
///
///   if (planLimite > 0 && citasMes >= planLimite) → 402
/// </summary>
public class PlanLimitTests
{
    // Replica la regla de negocio de ambos controladores
    private static bool AlcanzoPlanLimite(int planLimite, int citasMes)
    {
        if (planLimite <= 0) return false;
        return citasMes >= planLimite;
    }

    // Replica el cálculo del inicio de mes UTC usado en los controladores
    private static DateTime InicioMesUtc(DateTime utcNow) =>
        new DateTime(utcNow.Year, utcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void SinPlan_NuncaAlcanzaLimite()
    {
        AlcanzoPlanLimite(0, 0).Should().BeFalse("plan 0 significa sin límite");
        AlcanzoPlanLimite(0, 999).Should().BeFalse("sin plan no importa cuántas citas haya");
    }

    [Fact]
    public void ConPlan_CitasBajoLimite_NoBloquea()
    {
        AlcanzoPlanLimite(50, 0).Should().BeFalse();
        AlcanzoPlanLimite(50, 49).Should().BeFalse("49 < 50, debe pasar");
    }

    [Fact]
    public void ConPlan_CitasIgualLimite_Bloquea()
    {
        AlcanzoPlanLimite(50, 50).Should().BeTrue("exactamente en el límite → 402");
    }

    [Fact]
    public void ConPlan_CitasSuperanLimite_Bloquea()
    {
        AlcanzoPlanLimite(50, 51).Should().BeTrue("superar el límite también bloquea");
        AlcanzoPlanLimite(50, 100).Should().BeTrue();
    }

    [Fact]
    public void PlanLimite1_PrimeraCita_NoBloquea()
    {
        AlcanzoPlanLimite(1, 0).Should().BeFalse("sin citas previas, la primera puede crearse");
    }

    [Fact]
    public void PlanLimite1_SegundaCita_Bloquea()
    {
        AlcanzoPlanLimite(1, 1).Should().BeTrue("plan de 1 cita: con 1 ya usada, la segunda se bloquea");
    }

    [Fact]
    public void PlanNegativo_NuncaAlcanzaLimite()
    {
        // Valor defensivo: planLimite negativo tratado como "sin límite"
        AlcanzoPlanLimite(-1, 100).Should().BeFalse("valor negativo se trata como sin límite");
    }

    [Theory]
    [InlineData(10, 0, false)]
    [InlineData(10, 9, false)]
    [InlineData(10, 10, true)]
    [InlineData(10, 11, true)]
    [InlineData(100, 99, false)]
    [InlineData(100, 100, true)]
    public void Theory_PlanLimite(int planLimite, int citasMes, bool esperaBloqueo)
    {
        AlcanzoPlanLimite(planLimite, citasMes).Should().Be(esperaBloqueo);
    }

    // ── Cálculo de inicio de mes ────────────────────────────────────────────────

    [Fact]
    public void InicioMes_EsPrimerDia_Medianoche_Utc()
    {
        var ahora = new DateTime(2026, 7, 15, 14, 30, 0, DateTimeKind.Utc);
        var inicio = InicioMesUtc(ahora);

        inicio.Should().Be(new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc));
        inicio.Kind.Should().Be(DateTimeKind.Utc);
    }

    [Fact]
    public void InicioMes_EnEnero_EsEl1Enero()
    {
        var ahora = new DateTime(2026, 1, 31, 23, 59, 59, DateTimeKind.Utc);
        var inicio = InicioMesUtc(ahora);

        inicio.Should().Be(new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void InicioMes_ElPrimerDiaDelMes_EsElMismoDia()
    {
        var ahora = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);
        var inicio = InicioMesUtc(ahora);

        inicio.Should().Be(new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void CitaDeEsteMes_ContabilizaContraLimite()
    {
        var ahora = new DateTime(2026, 7, 10, 12, 0, 0, DateTimeKind.Utc);
        var inicioMes = InicioMesUtc(ahora);
        var citaEsteMes = new DateTime(2026, 7, 5, 10, 0, 0, DateTimeKind.Utc);

        (citaEsteMes >= inicioMes).Should().BeTrue("cita del mismo mes debe contabilizarse");
    }

    [Fact]
    public void CitaDelMesAnterior_NoContabilizaContraLimite()
    {
        var ahora = new DateTime(2026, 7, 10, 12, 0, 0, DateTimeKind.Utc);
        var inicioMes = InicioMesUtc(ahora);
        var citaMesAnterior = new DateTime(2026, 6, 30, 23, 59, 59, DateTimeKind.Utc);

        (citaMesAnterior >= inicioMes).Should().BeFalse("cita del mes anterior no debe contabilizarse");
    }
}
