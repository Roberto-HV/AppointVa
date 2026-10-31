using System.Text.Json;
using AppointVaAPI.Models.Dtos.Citas;
using AppointVaAPI.Services;
using FluentAssertions;

namespace AppointVaAPI.Tests.Services;

/// <summary>
/// The receipt email must show the same rows as the printed ticket. Both read the
/// golden vectors in Fixtures/ticket-vectores.json: this suite runs them through
/// EmailService.ResumirTicket, Front/src/utils/ticketRecibo.test.ts through resumirTicket.
/// </summary>
public class TicketVectoresTests
{
    private static readonly JsonSerializerOptions Opciones = new() { PropertyNameCaseInsensitive = true };

    private static JsonElement Vectores()
    {
        var ruta = Path.Combine(AppContext.BaseDirectory, "Fixtures", "ticket-vectores.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(ruta));
        return doc.RootElement.GetProperty("vectores").Clone();
    }

    public static IEnumerable<object[]> Nombres() =>
        Vectores().EnumerateArray().Select(v => new object[] { v.GetProperty("nombre").GetString()! });

    private static List<string[]> Renglones(JsonElement filas) =>
        filas.EnumerateArray().Select(f => f.EnumerateArray().Select(c => c.GetString()!).ToArray()).ToList();

    [Fact]
    public void Fixture_HasTheRequiredScenarios()
    {
        Vectores().GetArrayLength().Should().BeGreaterThanOrEqualTo(10);
    }

    [Theory]
    [MemberData(nameof(Nombres))]
    public void ResumirTicket_MatchesTheSharedVector(string nombre)
    {
        var vector = Vectores().EnumerateArray().Single(v => v.GetProperty("nombre").GetString() == nombre);
        var esperado = vector.GetProperty("esperado");

        var datos = vector.GetProperty("entrada").Deserialize<TicketCitaDatos>(Opciones)! with
        {
            Servicio = "Corte de dama",
            DuracionMinutos = 45,
            Sector = vector.TryGetProperty("sector", out var s) ? s.GetString() : null,
        };

        var r = EmailService.ResumirTicket(datos);

        EmailService.Dinero(r.PrecioLista).Should().Be(esperado.GetProperty("servicio").GetString());
        r.Totales.Select(t => new[] { t.Etiqueta, t.Monto }).Should()
            .BeEquivalentTo(Renglones(esperado.GetProperty("totales")), o => o.WithStrictOrdering());
        EmailService.Dinero(r.Total).Should().Be(esperado.GetProperty("total").GetString());

        var saldo = esperado.GetProperty("saldoAFavor");
        if (saldo.ValueKind == JsonValueKind.Null)
            r.FilaSaldoAFavor.Should().BeNull();
        else
            new[] { r.FilaSaldoAFavor!.Etiqueta, r.FilaSaldoAFavor.Monto }.Should()
                .Equal(saldo.EnumerateArray().Select(c => c.GetString()));

        r.Pagos.Select(p => new[] { p.Etiqueta, p.Monto }).Should()
            .BeEquivalentTo(Renglones(esperado.GetProperty("pagos")), o => o.WithStrictOrdering());
        r.EtiquetaEmpleado.Should().Be(esperado.GetProperty("etiquetaEmpleado").GetString());

        // The rows close on paper: Subtotal − discounts − advance + extra charge = TOTAL.
        (r.PrecioLista - r.DescuentoCupon - r.DescuentoCaja - r.Anticipo + r.CargoAdicional).Should().Be(r.Total);
    }
}
