using FluentAssertions;

namespace AppointVaAPI.Tests;

/// <summary>
/// Verifica la detección de solapamiento de slots.
/// Replica la fórmula de DisponibilidadService:
///
///   solapaCita = citasEmp.Any(c => c.InicioEn &lt; slotFin &amp;&amp; c.FinEn > slotInicio)
/// </summary>
public class SlotSolapamientoTests
{
    private static readonly DateTime Base = new(2026, 6, 10, 9, 0, 0, DateTimeKind.Utc);

    // Slot candidato: 09:00 – 09:30
    private static readonly DateTime SlotInicio = Base;
    private static readonly DateTime SlotFin    = Base.AddMinutes(30);

    private static bool SeSolapa(DateTime existInicio, DateTime existFin) =>
        existInicio < SlotFin && existFin > SlotInicio;

    // ── Casos sin solapamiento ─────────────────────────────────────────────────

    [Fact]
    public void CitaAnterior_SinSolape()
    {
        // 08:00–09:00 termina justo cuando empieza el slot (adyacente, no solapado)
        SeSolapa(Base.AddMinutes(-60), Base).Should().BeFalse("adyacente al inicio no solapa");
    }

    [Fact]
    public void CitaPosterior_SinSolape()
    {
        // 09:30–10:00 empieza justo cuando termina el slot
        SeSolapa(Base.AddMinutes(30), Base.AddMinutes(60)).Should().BeFalse("adyacente al final no solapa");
    }

    [Fact]
    public void CitaMuchoAntes_SinSolape()
    {
        SeSolapa(Base.AddHours(-2), Base.AddHours(-1)).Should().BeFalse();
    }

    [Fact]
    public void CitaMuchoDespues_SinSolape()
    {
        SeSolapa(Base.AddHours(1), Base.AddHours(2)).Should().BeFalse();
    }

    // ── Casos con solapamiento ─────────────────────────────────────────────────

    [Fact]
    public void CitaIdentica_Solapa()
    {
        SeSolapa(SlotInicio, SlotFin).Should().BeTrue("mismo intervalo solapa");
    }

    [Fact]
    public void CitaDentroDelSlot_Solapa()
    {
        // 09:05–09:25 completamente dentro del slot 09:00–09:30
        SeSolapa(Base.AddMinutes(5), Base.AddMinutes(25)).Should().BeTrue();
    }

    [Fact]
    public void CitaQueEngloba_Solapa()
    {
        // 08:50–09:40 engloba completamente al slot
        SeSolapa(Base.AddMinutes(-10), Base.AddMinutes(40)).Should().BeTrue();
    }

    [Fact]
    public void CitaSolapeInicio_Solapa()
    {
        // 08:50–09:10 solapa el inicio del slot
        SeSolapa(Base.AddMinutes(-10), Base.AddMinutes(10)).Should().BeTrue();
    }

    [Fact]
    public void CitaSolapeFinal_Solapa()
    {
        // 09:20–09:40 solapa el final del slot
        SeSolapa(Base.AddMinutes(20), Base.AddMinutes(40)).Should().BeTrue();
    }

    // ── Generación de slots: ventana de horario ────────────────────────────────

    [Fact]
    public void Generacion_HorarioDe4h_Duracion30min_DebeGenerar8Slots()
    {
        // Horario: 09:00–13:00, servicio de 30 min → 8 slots
        var horarioInicio = Base;
        var horarioFin = Base.AddHours(4);
        var duracion = TimeSpan.FromMinutes(30);

        var slots = new List<DateTime>();
        var slot = horarioInicio;
        while (slot + duracion <= horarioFin)
        {
            slots.Add(slot);
            slot = slot.Add(duracion);
        }

        slots.Should().HaveCount(8);
        slots.First().Should().Be(Base);
        slots.Last().Should().Be(Base.AddMinutes(30 * 7));
    }

    [Fact]
    public void Generacion_DuracionNoExacta_NoAgregaSlotParcial()
    {
        // Horario: 09:00–10:50, duración 60 min → solo 1 slot (09:00–10:00), no cabe 10:00–11:00
        var horarioInicio = Base;
        var horarioFin = Base.AddMinutes(110); // 1h50m
        var duracion = TimeSpan.FromMinutes(60);

        var slots = new List<DateTime>();
        var slot = horarioInicio;
        while (slot + duracion <= horarioFin)
        {
            slots.Add(slot);
            slot = slot.Add(duracion);
        }

        slots.Should().HaveCount(1, "solo cabe 1 slot completo de 60 min en 1h50m");
    }

    [Fact]
    public void Generacion_HorarioCerrado_NingunSlot()
    {
        // Si horarioInicio == horarioFin, no hay slots
        var horarioInicio = Base;
        var horarioFin = Base;
        var duracion = TimeSpan.FromMinutes(30);

        var slots = new List<DateTime>();
        var slot = horarioInicio;
        while (slot + duracion <= horarioFin)
        {
            slots.Add(slot);
            slot = slot.Add(duracion);
        }

        slots.Should().BeEmpty();
    }
}
