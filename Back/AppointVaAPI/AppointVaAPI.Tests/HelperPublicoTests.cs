using System.Reflection;
using AppointVaAPI.Constants;
using AppointVaAPI.Controllers.V1;
using FluentAssertions;

namespace AppointVaAPI.Tests;

public class HelperPublicoTests
{
    // ── GenerarCodigoConfirmacion ────────────────────────────────────────────────

    private static readonly MethodInfo _generarCodigo =
        typeof(PublicoController)
            .GetMethod("GenerarCodigoConfirmacion", BindingFlags.NonPublic | BindingFlags.Static)!;

    private static string InvocarGenerarCodigo() =>
        (string)_generarCodigo.Invoke(null, null)!;

    [Fact]
    public void GenerarCodigo_Debe_Tener_8_Caracteres()
    {
        var codigo = InvocarGenerarCodigo();
        codigo.Should().HaveLength(8);
    }

    [Fact]
    public void GenerarCodigo_Debe_Ser_Hexadecimal_Mayusculas()
    {
        var codigo = InvocarGenerarCodigo();
        codigo.Should().MatchRegex("^[0-9A-F]{8}$");
    }

    [Fact]
    public void GenerarCodigo_Multiples_Llamadas_Deben_Ser_Distintos()
    {
        var codigos = Enumerable.Range(0, 20).Select(_ => InvocarGenerarCodigo()).ToHashSet();
        codigos.Should().HaveCountGreaterThan(1, "códigos aleatorios no deben repetirse en 20 intentos");
    }

    // ── ObtenerEstadoTexto ───────────────────────────────────────────────────────

    private static readonly MethodInfo _obtenerEstadoTexto =
        typeof(PublicoController)
            .GetMethod("ObtenerEstadoTexto",
                BindingFlags.NonPublic | BindingFlags.Public | BindingFlags.Static)!;

    private static string InvocarObtenerEstadoTexto(byte estado) =>
        (string)_obtenerEstadoTexto.Invoke(null, [(object)estado])!;

    [Theory]
    [InlineData(EstadosCitas.Pendiente,    "Pendiente")]
    [InlineData(EstadosCitas.Confirmada,   "Confirmada")]
    [InlineData(EstadosCitas.Completada,   "Completada")]
    [InlineData(EstadosCitas.Cancelada,    "Cancelada")]
    [InlineData(EstadosCitas.Inasistencia, "Inasistencia")]
    public void ObtenerEstadoTexto_Debe_Mapear_Correctamente(byte estado, string esperado)
    {
        InvocarObtenerEstadoTexto(estado).Should().Be(esperado);
    }

    [Fact]
    public void ObtenerEstadoTexto_EstadoDesconocido_Debe_Retornar_Desconocido()
    {
        InvocarObtenerEstadoTexto(99).Should().Be("Desconocido");
    }
}
