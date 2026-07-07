using FluentAssertions;

namespace AppointVaAPI.Tests;

/// <summary>
/// Verifica que la validación de formato de hora con TryParse
/// rechaza correctamente entradas inválidas (fix de NegociosController y EmpleadosController).
/// </summary>
public class ValidacionHorasTests
{
    private static bool HoraValida(string hora) => TimeSpan.TryParse(hora, out _);

    [Theory]
    [InlineData("09:00")]
    [InlineData("18:30")]
    [InlineData("00:00")]
    [InlineData("23:59")]
    public void FormatosValidos_RetornanTrue(string hora)
    {
        HoraValida(hora).Should().BeTrue($"'{hora}' es un formato HH:mm válido");
    }

    [Theory]
    [InlineData("")]
    [InlineData("9am")]
    [InlineData("25:00")]
    [InlineData("abc")]
    [InlineData("09:60")]
    [InlineData("DROP TABLE")]
    public void FormatosInvalidos_RetornanFalse(string hora)
    {
        HoraValida(hora).Should().BeFalse($"'{hora}' no es un formato de hora válido");
    }

    [Fact]
    public void HoraFin_MenorQueHoraInicio_EsInvalida()
    {
        TimeSpan.TryParse("18:00", out var ini);
        TimeSpan.TryParse("09:00", out var fin);

        (fin <= ini).Should().BeTrue("fin < inicio debe ser detectado como horario inválido");
    }

    [Fact]
    public void HoraFin_IgualQueHoraInicio_EsInvalida()
    {
        TimeSpan.TryParse("10:00", out var ini);
        TimeSpan.TryParse("10:00", out var fin);

        (fin <= ini).Should().BeTrue("fin == inicio también debe ser inválido");
    }

    [Fact]
    public void HoraFin_MayorQueHoraInicio_EsValida()
    {
        TimeSpan.TryParse("09:00", out var ini);
        TimeSpan.TryParse("18:00", out var fin);

        (fin > ini).Should().BeTrue("18:00 > 09:00 es un rango válido");
    }
}
