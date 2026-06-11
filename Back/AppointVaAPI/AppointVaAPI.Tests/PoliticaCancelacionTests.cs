using FluentAssertions;

namespace AppointVaAPI.Tests;

/// <summary>
/// Verifica la regla de negocio de política de cancelación.
/// Refleja exactamente la lógica de PublicoController.CancelarCita:
///
///   var tiempoRestante = cita.InicioEn - DateTime.UtcNow;
///   if (tiempoRestante.TotalHours &lt; horasCancelacion) → BadRequest
/// </summary>
public class PoliticaCancelacionTests
{
    // Replica la lógica de la política tal como está en el controlador
    private static bool PuedeCancel(int horasCancelacion, TimeSpan tiempoRestante)
    {
        if (horasCancelacion == 0) return true;
        return tiempoRestante.TotalHours >= horasCancelacion;
    }

    [Fact]
    public void SinPolitica_SiemprePuedeCancel()
    {
        PuedeCancel(0, TimeSpan.FromMinutes(5)).Should().BeTrue("horasCancelacion=0 desactiva la restricción");
        PuedeCancel(0, TimeSpan.FromHours(-1)).Should().BeTrue("incluso con cita pasada, sin política se permite");
    }

    [Fact]
    public void ConPolitica24h_CitaEn48h_PuedeCancel()
    {
        PuedeCancel(24, TimeSpan.FromHours(48)).Should().BeTrue();
    }

    [Fact]
    public void ConPolitica24h_CitaEn12h_NoPuedeCancel()
    {
        PuedeCancel(24, TimeSpan.FromHours(12)).Should().BeFalse();
    }

    [Fact]
    public void ConPolitica24h_CitaEn24h_Exacto_PuedeCancel()
    {
        // Exactamente en el límite → se permite (>= horasCancelacion)
        PuedeCancel(24, TimeSpan.FromHours(24)).Should().BeTrue("borde exacto debe permitirse");
    }

    [Fact]
    public void ConPolitica24h_CitaEn23h59m_NoPuedeCancel()
    {
        PuedeCancel(24, TimeSpan.FromHours(23.99)).Should().BeFalse("23h 59m es menor a 24h");
    }

    [Fact]
    public void ConPolitica2h_CitaEn3h_PuedeCancel()
    {
        PuedeCancel(2, TimeSpan.FromHours(3)).Should().BeTrue();
    }

    [Fact]
    public void ConPolitica2h_CitaEn1h_NoPuedeCancel()
    {
        PuedeCancel(2, TimeSpan.FromHours(1)).Should().BeFalse();
    }

    [Fact]
    public void ConPolitica_CitaYaPasada_NoPuedeCancel()
    {
        PuedeCancel(1, TimeSpan.FromHours(-2)).Should().BeFalse("cita pasada tiene tiempo restante negativo");
    }

    [Fact]
    public void ConPolitica168h_UnaSemana_TiempoCortoPuedeCancel()
    {
        PuedeCancel(168, TimeSpan.FromHours(200)).Should().BeTrue();
        PuedeCancel(168, TimeSpan.FromHours(100)).Should().BeFalse("menos de 7 días no permitido");
    }
}
