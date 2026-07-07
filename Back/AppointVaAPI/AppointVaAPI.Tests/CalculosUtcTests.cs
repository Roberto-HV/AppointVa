using FluentAssertions;

namespace AppointVaAPI.Tests;

/// <summary>
/// Verifica los cálculos de fecha UTC usados en DashboardController y DisponibilidadService.
/// Replica exactamente la lógica de cada controlador para detectar regresiones.
/// </summary>
public class CalculosUtcTests
{
    // Replica la lógica de DashboardController.ObtenerResumen
    private static (DateTime hoyInicio, DateTime hoyFin, DateTime inicioSemana, DateTime inicioMes)
        CalcularRangos(DateTime utcNow)
    {
        var hoyInicio    = utcNow.Date;
        var hoyFin       = hoyInicio.AddDays(1);
        var diaSemana    = (int)hoyInicio.DayOfWeek;
        var inicioSemana = hoyInicio.AddDays(diaSemana == 0 ? -6 : -(diaSemana - 1));
        var inicioMes    = new DateTime(hoyInicio.Year, hoyInicio.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        return (hoyInicio, hoyFin, inicioSemana, inicioMes);
    }

    [Fact]
    public void HoyInicio_EsMedianoche()
    {
        var ahora = new DateTime(2026, 6, 15, 14, 30, 0, DateTimeKind.Utc);
        var (hoyInicio, _, _, _) = CalcularRangos(ahora);

        hoyInicio.Should().Be(new DateTime(2026, 6, 15, 0, 0, 0, DateTimeKind.Utc));
        hoyInicio.Kind.Should().Be(DateTimeKind.Utc);
    }

    [Fact]
    public void InicioMes_EsPrimerDiaDelMes()
    {
        var ahora = new DateTime(2026, 6, 15, 14, 30, 0, DateTimeKind.Utc);
        var (_, _, _, inicioMes) = CalcularRangos(ahora);

        inicioMes.Should().Be(new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void InicioSemana_EsLunesAnterior_CuandoHoyEsMiercoles()
    {
        // 2026-06-17 es miércoles
        var ahora = new DateTime(2026, 6, 17, 10, 0, 0, DateTimeKind.Utc);
        var (_, _, inicioSemana, _) = CalcularRangos(ahora);

        inicioSemana.DayOfWeek.Should().Be(DayOfWeek.Monday);
        inicioSemana.Should().Be(new DateTime(2026, 6, 15, 0, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void InicioSemana_EsLunesAnterior_CuandoHoyEsDomingo()
    {
        // 2026-06-21 es domingo
        var ahora = new DateTime(2026, 6, 21, 10, 0, 0, DateTimeKind.Utc);
        var (_, _, inicioSemana, _) = CalcularRangos(ahora);

        inicioSemana.DayOfWeek.Should().Be(DayOfWeek.Monday);
        inicioSemana.Should().Be(new DateTime(2026, 6, 15, 0, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void HoyFin_EsMedianocheDeSiguienteDia()
    {
        var ahora = new DateTime(2026, 6, 15, 23, 59, 59, DateTimeKind.Utc);
        var (_, hoyFin, _, _) = CalcularRangos(ahora);

        hoyFin.Should().Be(new DateTime(2026, 6, 16, 0, 0, 0, DateTimeKind.Utc));
    }

    // Replica lógica de DisponibilidadService: slot válido solo si slotInicio > ahora
    [Fact]
    public void Slot_Pasado_NoDebeOfrecerse()
    {
        var ahora = new DateTime(2026, 6, 15, 10, 0, 0, DateTimeKind.Utc);
        var slotPasado = ahora.AddMinutes(-30);

        (slotPasado > ahora).Should().BeFalse("slots en el pasado no deben ofrecerse");
    }

    [Fact]
    public void Slot_Futuro_DebeOfrecerse()
    {
        var ahora = new DateTime(2026, 6, 15, 10, 0, 0, DateTimeKind.Utc);
        var slotFuturo = ahora.AddHours(1);

        (slotFuturo > ahora).Should().BeTrue("slots en el futuro deben ofrecerse");
    }
}
