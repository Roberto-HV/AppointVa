using FluentAssertions;

namespace AppointVaAPI.Tests;

/// <summary>
/// Verifica la lógica de cálculo de porcentaje y colores del componente BarraProgreso
/// del SuperAdmin. Aunque vive en el frontend, los umbrales de negocio se documentan
/// aquí para mantener coherencia si se replica en el backend.
///
/// Umbrales del negocio:
///   pct &lt; 60  → verde  (uso normal)
///   pct &gt;= 60 → ámbar  (uso moderado)
///   pct &gt;= 85 → rojo   (uso crítico)
///   pct &gt;= 75 → muestra aviso "X restantes"
///   pct = 100 → muestra "Límite alcanzado"
/// </summary>
public class BarraProgresoLogicTests
{
    private static int CalcularPorcentaje(int valor, int maximo) =>
        maximo > 0 ? Math.Min((int)Math.Round((double)valor / maximo * 100), 100) : 0;

    private static string ColorBarra(int pct) =>
        pct >= 85 ? "rojo" : pct >= 60 ? "ambar" : "verde";

    private static bool MostrarAviso(int pct) => pct >= 75;

    private static string TextoAviso(int pct, int restantes) =>
        pct >= 100 ? "Límite alcanzado" : $"{restantes} restante{(restantes != 1 ? "s" : "")}";

    // ── Cálculo de porcentaje ───────────────────────────────────────────────────

    [Fact]
    public void Porcentaje_CeroSobreCero_EsCero()
    {
        CalcularPorcentaje(0, 0).Should().Be(0);
    }

    [Fact]
    public void Porcentaje_MitadDelMaximo_Es50()
    {
        CalcularPorcentaje(5, 10).Should().Be(50);
    }

    [Fact]
    public void Porcentaje_MaximoCompleto_Es100()
    {
        CalcularPorcentaje(10, 10).Should().Be(100);
    }

    [Fact]
    public void Porcentaje_SuperaMaximo_SeClampea100()
    {
        CalcularPorcentaje(15, 10).Should().Be(100, "no puede superar 100%");
    }

    [Fact]
    public void Porcentaje_SeRedondea()
    {
        CalcularPorcentaje(1, 3).Should().Be(33);
        CalcularPorcentaje(2, 3).Should().Be(67);
    }

    // ── Colores ─────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(0, "verde")]
    [InlineData(59, "verde")]
    [InlineData(60, "ambar")]
    [InlineData(84, "ambar")]
    [InlineData(85, "rojo")]
    [InlineData(100, "rojo")]
    public void Color_PorUmbrales(int pct, string colorEsperado)
    {
        ColorBarra(pct).Should().Be(colorEsperado);
    }

    // ── Aviso de restantes ──────────────────────────────────────────────────────

    [Theory]
    [InlineData(74, false)]
    [InlineData(75, true)]
    [InlineData(85, true)]
    [InlineData(100, true)]
    public void Aviso_SeMuestraDesde75Porciento(int pct, bool debeMostrar)
    {
        MostrarAviso(pct).Should().Be(debeMostrar);
    }

    [Fact]
    public void TextoAviso_PluralCuandoQuedan2OMas()
    {
        TextoAviso(80, 5).Should().Be("5 restantes");
        TextoAviso(90, 2).Should().Be("2 restantes");
    }

    [Fact]
    public void TextoAviso_SingularCuandoQueda1()
    {
        TextoAviso(90, 1).Should().Be("1 restante");
    }

    [Fact]
    public void TextoAviso_LimiteAlcanzadoCuandoEsCien()
    {
        TextoAviso(100, 0).Should().Be("Límite alcanzado");
    }
}
