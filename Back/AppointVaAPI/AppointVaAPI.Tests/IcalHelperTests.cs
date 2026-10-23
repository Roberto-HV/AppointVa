using System.Text;
using AppointVaAPI.Controllers.V1;
using AppointVaAPI.Helpers;
using FluentAssertions;
using Xunit;

namespace AppointVaAPI.Tests;

/// <summary>El .ics de "Agregar a Calendario de Apple" (RFC 5545) y la URL que lo sirve.</summary>
public class IcalHelperTests
{
    private static IcalHelper.EventoIcal Evento(string? lugar = "Calle Morelos 47, Col. Centro; Monterrey, NL") => new(
        Uid: "507E5262@appointva",
        InicioUtc: new DateTime(2026, 10, 1, 16, 0, 0, DateTimeKind.Utc),
        FinUtc: new DateTime(2026, 10, 1, 18, 30, 0, DateTimeKind.Utc),
        MarcaUtc: new DateTime(2026, 9, 30, 12, 0, 0, DateTimeKind.Utc),
        Resumen: "Mechas, Highlights con Aramis García",
        Descripcion: "Negocio: Salón Aramis\nServicio: Mechas / Highlights con un nombre muy largo para forzar el plegado de la línea\nCódigo: 507E5262",
        Lugar: lugar,
        OrganizadorNombre: "Salón Aramis, Centro",
        OrganizadorEmail: "hola@salonaramis.com");

    [Fact]
    public void Generar_TieneLosCamposObligatoriosYTerminaEnCrlf()
    {
        var ics = IcalHelper.Generar(Evento());

        ics.Should().StartWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:");
        ics.Should().EndWith("END:VCALENDAR\r\n");
        ics.Should().Contain("\r\nUID:507E5262@appointva\r\n");
        ics.Should().Contain("\r\nDTSTAMP:20260930T120000Z\r\n");
        ics.Should().Contain("\r\nDTSTART:20261001T160000Z\r\n");
        ics.Should().Contain("\r\nDTEND:20261001T183000Z\r\n");
        ics.Replace("\r\n", "").Should().NotContain("\n", "toda línea termina en CRLF");
        ics.Replace("\r\n", "").Should().NotContain("\r");
    }

    [Fact]
    public void Generar_EscapaComasPuntoYComaYSaltosEnTextos()
    {
        var ics = Desplegar(IcalHelper.Generar(Evento()));

        ics.Should().Contain("SUMMARY:Mechas\\, Highlights con Aramis García\r\n");
        ics.Should().Contain("LOCATION:Calle Morelos 47\\, Col. Centro\\; Monterrey\\, NL\r\n");
        ics.Should().Contain("DESCRIPTION:Negocio: Salón Aramis\\nServicio:");
        ics.Should().Contain("ORGANIZER;CN=\"Salón Aramis, Centro\":mailto:hola@salonaramis.com\r\n");
    }

    [Fact]
    public void Generar_NingunaLineaPasaDe75Octetos()
    {
        var ics = IcalHelper.Generar(Evento());

        foreach (var linea in ics.Split("\r\n"))
            Encoding.UTF8.GetByteCount(linea).Should().BeLessThanOrEqualTo(75, linea);
        ics.Should().Contain("\r\n ", "la descripción larga se pliega con CRLF + espacio");
    }

    [Fact]
    public void Generar_SinLugarNiOrganizador_OmiteEsasLineas()
    {
        var ics = IcalHelper.Generar(Evento(lugar: null) with { OrganizadorEmail = null });
        ics.Should().NotContain("LOCATION:");
        ics.Should().NotContain("ORGANIZER");
    }

    [Theory]
    [InlineData("https://appointva.onrender.com")]
    [InlineData("https://appointva.onrender.com/")]
    [InlineData("https://appointva.onrender.com/api")]
    [InlineData("https://appointva.onrender.com/api/")]
    public void UrlIcal_ToleraBarraYApiFinal(string backendUrl)
    {
        PublicoController.UrlIcal(backendUrl, "507E5262")
            .Should().Be("https://appointva.onrender.com/api/publico/citas/507E5262/ical");
    }

    [Fact]
    public void UrlIcal_SinBackendUrl_EsNull()
    {
        PublicoController.UrlIcal("", "507E5262").Should().BeNull();
        PublicoController.UrlIcal(null, "507E5262").Should().BeNull();
    }

    private static string Desplegar(string ics) => ics.Replace("\r\n ", "");
}
