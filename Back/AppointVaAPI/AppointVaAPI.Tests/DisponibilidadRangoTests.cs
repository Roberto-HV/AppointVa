using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Publico;
using AppointVaAPI.Services;
using AppointVaAPI.Tests.Controllers;
using FluentAssertions;

namespace AppointVaAPI.Tests;

/// <summary>
/// DisponibilidadService.ObtenerSlotsRangoAsync loads a whole range at once. Each day it
/// returns must match what the per-day method returns for that date: data from one day
/// (appointments, blocks, a closed date) must never leak into another.
/// </summary>
public class DisponibilidadRangoTests
{
    private const int Dias = 7;

    private sealed class Escenario
    {
        public required ApplicationDbContext Db { get; init; }
        public required DisponibilidadService Svc { get; init; }
        public required Guid NegocioId { get; init; }
        public required Guid ServicioId { get; init; }
        public required Guid AnaId { get; init; }
        public required Guid LuisId { get; init; }
        public required DateOnly Desde { get; init; }
    }

    /// <summary>
    /// Business open 09:00-18:00 every day except Sunday. Ana works Mon-Sat 09-18, Luis
    /// works Mon-Fri 12-18. The range starts tomorrow (business-local) and contains: a
    /// blocked date, a booked appointment for Ana, a cancelled one (ignored), a personal
    /// block for Luis, and always one Sunday.
    /// </summary>
    private static async Task<Escenario> CrearEscenarioAsync(string zonaHoraria = "UTC")
    {
        var db = DbContextFactory.Create(Guid.NewGuid().ToString());
        var negocioId = Guid.NewGuid();
        var servicioId = Guid.NewGuid();
        var anaId = Guid.NewGuid();
        var luisId = Guid.NewGuid();

        db.Negocios.Add(new Negocio
        {
            Id = negocioId, Slug = "rango-" + negocioId.ToString("N")[..8], Nombre = "Rango",
            ZonaHoraria = zonaHoraria, Activo = 1,
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        });
        db.Servicios.Add(new Servicio
        {
            Id = servicioId, NegocioId = negocioId, Nombre = "Corte",
            DuracionMinutos = 60, BufferMinutos = 15, Precio = 100m, Orden = 1, Activo = 1,
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        });
        foreach (var (id, nombre) in new[] { (anaId, "Ana"), (luisId, "Luis") })
        {
            db.Empleados.Add(new Empleado
            {
                Id = id, NegocioId = negocioId, Nombre = nombre, Activo = 1,
                FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
            });
            db.EmpleadosServicios.Add(new EmpleadoServicio { EmpleadoId = id, ServicioId = servicioId });
        }

        // Business: 1=Mon … 6=Sat open (0=Sun closed).
        for (byte d = 1; d <= 6; d++)
            db.HorariosNegocios.Add(new HorarioNegocio
            {
                Id = Guid.NewGuid(), NegocioId = negocioId, DiaSemana = d,
                HoraInicio = TimeSpan.FromHours(9), HoraFin = TimeSpan.FromHours(18), Activo = 1,
            });
        // Employees: 1=Mon … 7=Sun.
        for (byte d = 1; d <= 6; d++)
            db.HorariosEmpleados.Add(new HorarioEmpleado
            {
                Id = Guid.NewGuid(), EmpleadoId = anaId, DiaSemana = d,
                HoraInicio = TimeSpan.FromHours(9), HoraFin = TimeSpan.FromHours(18), Activo = 1,
            });
        for (byte d = 1; d <= 5; d++)
            db.HorariosEmpleados.Add(new HorarioEmpleado
            {
                Id = Guid.NewGuid(), EmpleadoId = luisId, DiaSemana = d,
                HoraInicio = TimeSpan.FromHours(12), HoraFin = TimeSpan.FromHours(18), Activo = 1,
            });

        var tz = TimeZoneInfo.FindSystemTimeZoneById(zonaHoraria);
        var desde = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz)).AddDays(1);
        var fechas = Enumerable.Range(0, Dias).Select(desde.AddDays).ToList();
        var laborables = fechas.Where(f => f.DayOfWeek is not DayOfWeek.Sunday and not DayOfWeek.Saturday).ToList();

        // Blocked date: the first weekday of the range.
        db.BloqueosNegocio.Add(new BloqueoNegocio
        {
            Id = Guid.NewGuid(), NegocioId = negocioId,
            Fecha = laborables[0].ToDateTime(TimeOnly.MinValue), FechaCreacion = DateTime.UtcNow,
        });

        // Ana booked 10:00-11:00 on the second weekday; a cancelled appointment at 14:00 is ignored.
        var diaCita = laborables[1].ToDateTime(TimeOnly.MinValue);
        AgregarCita(db, negocioId, anaId, servicioId, diaCita.AddHours(10), EstadosCitas.Confirmada);
        AgregarCita(db, negocioId, anaId, servicioId, diaCita.AddHours(14), EstadosCitas.Cancelada);

        // Luis blocked 12:00-15:00 on the third weekday.
        var diaBloqueo = laborables[2].ToDateTime(TimeOnly.MinValue);
        db.BloqueosHorarios.Add(new BloqueoHorario
        {
            Id = Guid.NewGuid(), EmpleadoId = luisId,
            InicioEn = diaBloqueo.AddHours(12), FinEn = diaBloqueo.AddHours(15), FechaCreacion = DateTime.UtcNow,
        });

        await db.SaveChangesAsync();
        return new Escenario
        {
            Db = db, Svc = new DisponibilidadService(db), NegocioId = negocioId, ServicioId = servicioId,
            AnaId = anaId, LuisId = luisId, Desde = desde,
        };
    }

    private static void AgregarCita(ApplicationDbContext db, Guid negocioId, Guid empleadoId, Guid servicioId,
        DateTime inicio, byte estado) =>
        db.Citas.Add(new Cita
        {
            Id = Guid.NewGuid(), NegocioId = negocioId, EmpleadoId = empleadoId, ServicioId = servicioId,
            ClienteId = Guid.NewGuid(), CodigoConfirmacion = Guid.NewGuid().ToString("N"),
            InicioEn = inicio, FinEn = inicio.AddHours(1), Estado = estado, Precio = 100m,
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        });

    private static async Task VerificarParidadAsync(Escenario e, Guid? empleadoId)
    {
        var rango = await e.Svc.ObtenerSlotsRangoAsync(e.NegocioId, e.ServicioId, empleadoId, e.Desde, Dias);

        rango.Should().HaveCount(Dias);
        for (var i = 0; i < Dias; i++)
        {
            var fecha = e.Desde.AddDays(i);
            rango[i].Fecha.Should().Be(fecha.ToString("yyyy-MM-dd"));

            var porDia = await e.Svc.ObtenerSlotsDisponiblesAsync(e.NegocioId, e.ServicioId, empleadoId, fecha);
            rango[i].Horarios.Should().BeEquivalentTo(porDia, o => o.WithStrictOrdering(),
                $"day {fecha:yyyy-MM-dd} must match the per-day result");
        }
    }

    // ── Parity ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Rango_SinEmpleado_CadaDiaCoincideConElCalculoPorDia()
    {
        var e = await CrearEscenarioAsync();
        await VerificarParidadAsync(e, empleadoId: null);
    }

    [Fact]
    public async Task Rango_ConEmpleadoElegido_CadaDiaCoincideConElCalculoPorDia()
    {
        var e = await CrearEscenarioAsync();
        await VerificarParidadAsync(e, e.AnaId);
        await VerificarParidadAsync(e, e.LuisId);
    }

    [Theory]
    [InlineData("Pacific/Kiritimati")] // UTC+14: business date is ahead of UTC most of the day
    [InlineData("Pacific/Pago_Pago")]  // UTC-11: business date is behind UTC most of the day
    public async Task Rango_ZonaHorariaLejosDeUtc_CoincideConElCalculoPorDia(string zona)
    {
        var e = await CrearEscenarioAsync(zona);
        await VerificarParidadAsync(e, empleadoId: null);
        await VerificarParidadAsync(e, e.AnaId);
    }

    // ── Expected content (not just parity) ────────────────────────────────────

    [Fact]
    public async Task Rango_DiaBloqueadoYDomingo_SonCerrados()
    {
        var e = await CrearEscenarioAsync();
        var rango = await e.Svc.ObtenerSlotsRangoAsync(e.NegocioId, e.ServicioId, null, e.Desde, Dias);

        var domingo = rango.Single(d => DateOnly.Parse(d.Fecha).DayOfWeek == DayOfWeek.Sunday);
        domingo.Estado.Should().Be(EstadosDiaDisponibilidad.Cerrado);
        domingo.Horarios.Should().BeEmpty();

        var primerLaborable = rango.First(d =>
            DateOnly.Parse(d.Fecha).DayOfWeek is not DayOfWeek.Sunday and not DayOfWeek.Saturday);
        primerLaborable.Estado.Should().Be(EstadosDiaDisponibilidad.Cerrado);
        primerLaborable.Horarios.Should().BeEmpty();

        rango.Where(d => d != domingo && d != primerLaborable)
            .Should().OnlyContain(d => d.Estado == EstadosDiaDisponibilidad.ConHorarios);
    }

    [Fact]
    public async Task Rango_CitaYBloqueoSoloAfectanASuDia()
    {
        var e = await CrearEscenarioAsync();
        var laborables = Enumerable.Range(0, Dias).Select(e.Desde.AddDays)
            .Where(f => f.DayOfWeek is not DayOfWeek.Sunday and not DayOfWeek.Saturday).ToList();

        var ana = await e.Svc.ObtenerSlotsRangoAsync(e.NegocioId, e.ServicioId, e.AnaId, e.Desde, Dias);
        var diaCita = ana.Single(d => d.Fecha == laborables[1].ToString("yyyy-MM-dd"));
        var diaLibre = ana.Single(d => d.Fecha == laborables[2].ToString("yyyy-MM-dd"));
        // 10:00-11:00 booked + 15 min buffer: the 10:00 slot is gone; the cancelled 14:00 one is not.
        diaCita.Horarios.Select(s => s.Inicio.Hour).Should().NotContain(10).And.Contain(14);
        diaLibre.Horarios.Select(s => s.Inicio.Hour).Should().Contain(10);

        var luis = await e.Svc.ObtenerSlotsRangoAsync(e.NegocioId, e.ServicioId, e.LuisId, e.Desde, Dias);
        var diaBloqueo = luis.Single(d => d.Fecha == laborables[2].ToString("yyyy-MM-dd"));
        diaBloqueo.Horarios.Select(s => s.Inicio.Hour).Should().Equal(15, 16, 17);
        luis.Single(d => d.Fecha == laborables[1].ToString("yyyy-MM-dd"))
            .Horarios.Select(s => s.Inicio.Hour).Should().Equal(12, 13, 14, 15, 16, 17);
    }

    [Fact]
    public async Task Rango_EmpleadoQueNoTrabajaElSabado_SabadoSinHorarios()
    {
        var e = await CrearEscenarioAsync();
        var luis = await e.Svc.ObtenerSlotsRangoAsync(e.NegocioId, e.ServicioId, e.LuisId, e.Desde, Dias);

        var sabado = luis.Single(d => DateOnly.Parse(d.Fecha).DayOfWeek == DayOfWeek.Saturday);
        sabado.Estado.Should().Be(EstadosDiaDisponibilidad.SinHorarios, "the business is open, Luis is not");
    }

    [Fact]
    public async Task Rango_SinPreferencia_UnSlotPorHoraConElEmpleadoQueLoAtiende()
    {
        var e = await CrearEscenarioAsync();
        var rango = await e.Svc.ObtenerSlotsRangoAsync(e.NegocioId, e.ServicioId, null, e.Desde, Dias);

        foreach (var dia in rango.Where(d => d.Estado == EstadosDiaDisponibilidad.ConHorarios))
        {
            dia.Horarios.Select(s => s.Inicio).Should().OnlyHaveUniqueItems().And.BeInAscendingOrder();
            dia.Horarios.Should().OnlyContain(s => s.EmpleadoId == e.AnaId || s.EmpleadoId == e.LuisId);
        }
    }

    [Fact]
    public async Task Rango_ServicioInexistente_DevuelveTodosLosDiasSinHorarios()
    {
        var e = await CrearEscenarioAsync();
        var rango = await e.Svc.ObtenerSlotsRangoAsync(e.NegocioId, Guid.NewGuid(), null, e.Desde, 3);

        rango.Should().HaveCount(3)
            .And.OnlyContain(d => d.Estado == EstadosDiaDisponibilidad.SinHorarios && d.Horarios.Count == 0);
    }

    [Fact]
    public async Task Rango_EmpleadoQueNoOfreceElServicio_SinHorarios()
    {
        var e = await CrearEscenarioAsync();
        var rango = await e.Svc.ObtenerSlotsRangoAsync(e.NegocioId, e.ServicioId, Guid.NewGuid(), e.Desde, Dias);

        rango.Should().OnlyContain(d => d.Horarios.Count == 0);
    }
}
