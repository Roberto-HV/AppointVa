using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Services;
using AppointVaAPI.Tests.Controllers;
using FluentAssertions;

namespace AppointVaAPI.Tests;

/// <summary>
/// Integration tests for DisponibilidadService.ObtenerSlotsDisponiblesAsync.
/// Each test uses an isolated InMemory database. Both the single-employee path
/// (empleadoId provided) and the multi-employee path (empleadoId = null) are covered.
/// </summary>
public class DisponibilidadServiceTests
{
    // ── Infrastructure helpers ─────────────────────────────────────────────────

    private static ApplicationDbContext CreateDb() =>
        DbContextFactory.Create(Guid.NewGuid().ToString());

    private static DisponibilidadService CreateService(ApplicationDbContext db) => new(db);

    /// <summary>
    /// Returns the next occurrence of <paramref name="target"/> day-of-week,
    /// always at least one day in the future so slots are never "past".
    /// </summary>
    private static DateOnly NextWeekday(DayOfWeek target)
    {
        var today = DateTime.UtcNow.Date;
        var daysUntil = ((int)target - (int)today.DayOfWeek + 7) % 7;
        if (daysUntil == 0) daysUntil = 7;
        return DateOnly.FromDateTime(today.AddDays(daysUntil));
    }

    /// <summary>Maps a .NET DayOfWeek to the byte value used by HorarioEmpleado (Sun=7).</summary>
    private static byte ToDiaSemana(DayOfWeek dow) =>
        (byte)(dow == DayOfWeek.Sunday ? 7 : (int)dow);

    // ── Seed helpers ──────────────────────────────────────────────────────────

    private static (Guid negocioId, Servicio servicio) SeedServicio(
        ApplicationDbContext db,
        int duracionMinutos = 60,
        int bufferMinutos = 0)
    {
        var negocioId = Guid.NewGuid();
        var servicio = new Servicio
        {
            Id = Guid.NewGuid(),
            NegocioId = negocioId,
            Nombre = "Servicio Test",
            DuracionMinutos = duracionMinutos,
            BufferMinutos = bufferMinutos,
            Precio = 100m,
            Orden = 1,
            Activo = 1,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        };
        db.Servicios.Add(servicio);
        return (negocioId, servicio);
    }

    private static Empleado SeedEmpleado(ApplicationDbContext db, Guid negocioId)
    {
        var emp = new Empleado
        {
            Id = Guid.NewGuid(),
            NegocioId = negocioId,
            Nombre = "Empleado Test",
            Activo = 1,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        };
        db.Empleados.Add(emp);
        return emp;
    }

    private static void SeedEmpleadoServicio(
        ApplicationDbContext db, Guid empleadoId, Guid servicioId)
    {
        db.EmpleadosServicios.Add(new EmpleadoServicio
        {
            EmpleadoId = empleadoId,
            ServicioId = servicioId,
        });
    }

    private static void SeedHorario(
        ApplicationDbContext db,
        Guid empleadoId,
        byte diaSemana,
        TimeSpan inicio,
        TimeSpan fin)
    {
        db.HorariosEmpleados.Add(new HorarioEmpleado
        {
            Id = Guid.NewGuid(),
            EmpleadoId = empleadoId,
            DiaSemana = diaSemana,
            HoraInicio = inicio,
            HoraFin = fin,
            Activo = 1,
        });
    }

    private static void SeedCita(
        ApplicationDbContext db,
        Guid negocioId,
        Guid empleadoId,
        Guid servicioId,
        DateTime inicioEn,
        DateTime finEn,
        byte estado)
    {
        db.Citas.Add(new Cita
        {
            Id = Guid.NewGuid(),
            NegocioId = negocioId,
            EmpleadoId = empleadoId,
            ServicioId = servicioId,
            ClienteId = Guid.NewGuid(),
            CodigoConfirmacion = Guid.NewGuid().ToString("N"),
            InicioEn = inicioEn,
            FinEn = finEn,
            Estado = estado,
            Precio = 100m,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        });
    }

    private static void SeedBloqueoNegocio(
        ApplicationDbContext db, Guid negocioId, DateTime fecha)
    {
        db.BloqueosNegocio.Add(new BloqueoNegocio
        {
            Id = Guid.NewGuid(),
            NegocioId = negocioId,
            Fecha = fecha,
            FechaCreacion = DateTime.UtcNow,
        });
    }

    private static void SeedBloqueoHorario(
        ApplicationDbContext db, Guid empleadoId, DateTime inicio, DateTime fin)
    {
        db.BloqueosHorarios.Add(new BloqueoHorario
        {
            Id = Guid.NewGuid(),
            EmpleadoId = empleadoId,
            InicioEn = inicio,
            FinEn = fin,
            FechaCreacion = DateTime.UtcNow,
        });
    }

    // ── Tests — guard conditions ───────────────────────────────────────────────

    [Fact]
    public async Task ObtenerSlots_RetornaVacio_CuandoDiaEstaBloquedoParaElNegocio()
    {
        var db = CreateDb();
        var svc = CreateService(db);
        var (negocioId, servicio) = SeedServicio(db);
        var fecha = NextWeekday(DayOfWeek.Monday);
        var fechaDt = fecha.ToDateTime(TimeOnly.MinValue);
        SeedBloqueoNegocio(db, negocioId, fechaDt);
        await db.SaveChangesAsync();

        var result = await svc.ObtenerSlotsDisponiblesAsync(negocioId, servicio.Id, null, fecha);

        result.Should().BeEmpty("un día bloqueado no debe exponer ningún slot");
    }

    [Fact]
    public async Task ObtenerSlots_RetornaVacio_CuandoServicioNoPerteneceAlNegocio()
    {
        var db = CreateDb();
        var svc = CreateService(db);
        var (_, servicio) = SeedServicio(db);
        await db.SaveChangesAsync();

        var otroNegocioId = Guid.NewGuid();
        var fecha = NextWeekday(DayOfWeek.Monday);

        var result = await svc.ObtenerSlotsDisponiblesAsync(otroNegocioId, servicio.Id, null, fecha);

        result.Should().BeEmpty("el servicio pertenece a otro negocio");
    }

    [Fact]
    public async Task ObtenerSlots_RetornaVacio_CuandoServicioEstaInactivo()
    {
        var db = CreateDb();
        var svc = CreateService(db);
        var negocioId = Guid.NewGuid();
        var servicio = new Servicio
        {
            Id = Guid.NewGuid(),
            NegocioId = negocioId,
            Nombre = "Servicio inactivo",
            DuracionMinutos = 60,
            BufferMinutos = 0,
            Precio = 100m,
            Orden = 1,
            Activo = 0, // inactivo
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        };
        db.Servicios.Add(servicio);
        await db.SaveChangesAsync();

        var fecha = NextWeekday(DayOfWeek.Monday);
        var result = await svc.ObtenerSlotsDisponiblesAsync(negocioId, servicio.Id, null, fecha);

        result.Should().BeEmpty("Activo=0 excluye el servicio de la búsqueda");
    }

    // ── Tests — single-employee path ──────────────────────────────────────────

    [Fact]
    public async Task ObtenerSlots_RetornaVacio_CuandoEmpleadoNoOfreceElServicio()
    {
        var db = CreateDb();
        var svc = CreateService(db);
        var (negocioId, servicio) = SeedServicio(db);
        var empleado = SeedEmpleado(db, negocioId);
        var fecha = NextWeekday(DayOfWeek.Monday);
        SeedHorario(db, empleado.Id, ToDiaSemana(DayOfWeek.Monday),
            new TimeSpan(9, 0, 0), new TimeSpan(11, 0, 0));
        // Deliberadamente NO se hace SeedEmpleadoServicio
        await db.SaveChangesAsync();

        var result = await svc.ObtenerSlotsDisponiblesAsync(negocioId, servicio.Id, empleado.Id, fecha);

        result.Should().BeEmpty("sin el vínculo EmpleadoServicio el empleado no puede atender el servicio");
    }

    [Fact]
    public async Task ObtenerSlots_RetornaVacio_CuandoEmpleadoNoTieneHorarioParaEseDia()
    {
        var db = CreateDb();
        var svc = CreateService(db);
        var (negocioId, servicio) = SeedServicio(db);
        var empleado = SeedEmpleado(db, negocioId);
        SeedEmpleadoServicio(db, empleado.Id, servicio.Id);
        var fecha = NextWeekday(DayOfWeek.Monday);
        // Horario sólo para martes, no para el lunes solicitado
        SeedHorario(db, empleado.Id, ToDiaSemana(DayOfWeek.Tuesday),
            new TimeSpan(9, 0, 0), new TimeSpan(11, 0, 0));
        await db.SaveChangesAsync();

        var result = await svc.ObtenerSlotsDisponiblesAsync(negocioId, servicio.Id, empleado.Id, fecha);

        result.Should().BeEmpty("sin horario para ese día de la semana no hay slots");
    }

    [Fact]
    public async Task ObtenerSlots_RetornaSlotsCorrecto_CaminoFelizEmpleadoEspecifico()
    {
        // Servicio 60 min, ventana 09:00-11:00 → esperamos slots 09:00 y 10:00
        var db = CreateDb();
        var svc = CreateService(db);
        var (negocioId, servicio) = SeedServicio(db, duracionMinutos: 60);
        var empleado = SeedEmpleado(db, negocioId);
        SeedEmpleadoServicio(db, empleado.Id, servicio.Id);
        var fecha = NextWeekday(DayOfWeek.Monday);
        SeedHorario(db, empleado.Id, ToDiaSemana(DayOfWeek.Monday),
            new TimeSpan(9, 0, 0), new TimeSpan(11, 0, 0));
        await db.SaveChangesAsync();

        var result = await svc.ObtenerSlotsDisponiblesAsync(negocioId, servicio.Id, empleado.Id, fecha);

        result.Should().HaveCount(2);
        result[0].HoraTexto.Should().Be("09:00");
        result[1].HoraTexto.Should().Be("10:00");
    }

    [Fact]
    public async Task ObtenerSlots_BloquearSlot_CuandoCitaPendienteOcupaHorario()
    {
        var db = CreateDb();
        var svc = CreateService(db);
        var (negocioId, servicio) = SeedServicio(db, duracionMinutos: 60);
        var empleado = SeedEmpleado(db, negocioId);
        SeedEmpleadoServicio(db, empleado.Id, servicio.Id);
        var fecha = NextWeekday(DayOfWeek.Monday);
        SeedHorario(db, empleado.Id, ToDiaSemana(DayOfWeek.Monday),
            new TimeSpan(9, 0, 0), new TimeSpan(11, 0, 0));
        var fechaDt = fecha.ToDateTime(TimeOnly.MinValue);
        SeedCita(db, negocioId, empleado.Id, servicio.Id,
            fechaDt.AddHours(9), fechaDt.AddHours(10), EstadosCitas.Pendiente);
        await db.SaveChangesAsync();

        var result = await svc.ObtenerSlotsDisponiblesAsync(negocioId, servicio.Id, empleado.Id, fecha);

        result.Should().HaveCount(1);
        result[0].HoraTexto.Should().Be("10:00", "el slot de 09:00 debe estar bloqueado por la cita Pendiente");
    }

    [Fact]
    public async Task ObtenerSlots_BloquearSlot_CuandoCitaConfirmadaOcupaHorario()
    {
        var db = CreateDb();
        var svc = CreateService(db);
        var (negocioId, servicio) = SeedServicio(db, duracionMinutos: 60);
        var empleado = SeedEmpleado(db, negocioId);
        SeedEmpleadoServicio(db, empleado.Id, servicio.Id);
        var fecha = NextWeekday(DayOfWeek.Monday);
        SeedHorario(db, empleado.Id, ToDiaSemana(DayOfWeek.Monday),
            new TimeSpan(9, 0, 0), new TimeSpan(11, 0, 0));
        var fechaDt = fecha.ToDateTime(TimeOnly.MinValue);
        SeedCita(db, negocioId, empleado.Id, servicio.Id,
            fechaDt.AddHours(9), fechaDt.AddHours(10), EstadosCitas.Confirmada);
        await db.SaveChangesAsync();

        var result = await svc.ObtenerSlotsDisponiblesAsync(negocioId, servicio.Id, empleado.Id, fecha);

        result.Should().HaveCount(1);
        result[0].HoraTexto.Should().Be("10:00", "el slot de 09:00 debe estar bloqueado por la cita Confirmada");
    }

    [Fact]
    public async Task ObtenerSlots_NoBloquearSlot_CuandoCitaCanceladaOcupaMismoHorario()
    {
        var db = CreateDb();
        var svc = CreateService(db);
        var (negocioId, servicio) = SeedServicio(db, duracionMinutos: 60);
        var empleado = SeedEmpleado(db, negocioId);
        SeedEmpleadoServicio(db, empleado.Id, servicio.Id);
        var fecha = NextWeekday(DayOfWeek.Monday);
        SeedHorario(db, empleado.Id, ToDiaSemana(DayOfWeek.Monday),
            new TimeSpan(9, 0, 0), new TimeSpan(11, 0, 0));
        var fechaDt = fecha.ToDateTime(TimeOnly.MinValue);
        SeedCita(db, negocioId, empleado.Id, servicio.Id,
            fechaDt.AddHours(9), fechaDt.AddHours(10), EstadosCitas.Cancelada);
        await db.SaveChangesAsync();

        var result = await svc.ObtenerSlotsDisponiblesAsync(negocioId, servicio.Id, empleado.Id, fecha);

        result.Should().HaveCount(2, "una cita Cancelada no bloquea slots");
    }

    [Fact]
    public async Task ObtenerSlots_BufferExtiendeBloqueo_CitaConBufferTapaSlotInmediato()
    {
        // Cita de 08:00-09:00 con buffer de 15 min → ocupa efectivamente hasta 09:15
        // El slot 09:00-10:00 queda bloqueado; el slot 10:00-11:00 debe quedar libre.
        var db = CreateDb();
        var svc = CreateService(db);
        var (negocioId, servicio) = SeedServicio(db, duracionMinutos: 60, bufferMinutos: 15);
        var empleado = SeedEmpleado(db, negocioId);
        SeedEmpleadoServicio(db, empleado.Id, servicio.Id);
        var fecha = NextWeekday(DayOfWeek.Monday);
        SeedHorario(db, empleado.Id, ToDiaSemana(DayOfWeek.Monday),
            new TimeSpan(9, 0, 0), new TimeSpan(11, 0, 0));
        var fechaDt = fecha.ToDateTime(TimeOnly.MinValue);
        // Cita termina a las 09:00; con buffer de 15 min bloquea hasta 09:15
        SeedCita(db, negocioId, empleado.Id, servicio.Id,
            fechaDt.AddHours(8), fechaDt.AddHours(9), EstadosCitas.Confirmada);
        await db.SaveChangesAsync();

        var result = await svc.ObtenerSlotsDisponiblesAsync(negocioId, servicio.Id, empleado.Id, fecha);

        result.Should().HaveCount(1, "el buffer debe extender el bloqueo al slot de las 09:00");
        result[0].HoraTexto.Should().Be("10:00");
    }

    [Fact]
    public async Task ObtenerSlots_BloquearSlot_CuandoBloqueoHorarioSolapaConElSlot()
    {
        var db = CreateDb();
        var svc = CreateService(db);
        var (negocioId, servicio) = SeedServicio(db, duracionMinutos: 60);
        var empleado = SeedEmpleado(db, negocioId);
        SeedEmpleadoServicio(db, empleado.Id, servicio.Id);
        var fecha = NextWeekday(DayOfWeek.Monday);
        SeedHorario(db, empleado.Id, ToDiaSemana(DayOfWeek.Monday),
            new TimeSpan(9, 0, 0), new TimeSpan(11, 0, 0));
        var fechaDt = fecha.ToDateTime(TimeOnly.MinValue);
        // Bloqueo manual de 09:00 a 10:00
        SeedBloqueoHorario(db, empleado.Id, fechaDt.AddHours(9), fechaDt.AddHours(10));
        await db.SaveChangesAsync();

        var result = await svc.ObtenerSlotsDisponiblesAsync(negocioId, servicio.Id, empleado.Id, fecha);

        result.Should().HaveCount(1);
        result[0].HoraTexto.Should().Be("10:00", "el bloqueo horario debe eliminar el slot de 09:00");
    }

    [Fact]
    public async Task ObtenerSlots_RetornaVacio_CuandoFechaEsDelPasado()
    {
        // Todos los slotInicio serán < DateTime.UtcNow → ninguno pasa la guarda "slotInicio > ahora"
        var db = CreateDb();
        var svc = CreateService(db);
        var (negocioId, servicio) = SeedServicio(db, duracionMinutos: 60);
        var empleado = SeedEmpleado(db, negocioId);
        SeedEmpleadoServicio(db, empleado.Id, servicio.Id);
        var fechaAyer = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));
        SeedHorario(db, empleado.Id, ToDiaSemana(fechaAyer.DayOfWeek),
            new TimeSpan(9, 0, 0), new TimeSpan(17, 0, 0));
        await db.SaveChangesAsync();

        var result = await svc.ObtenerSlotsDisponiblesAsync(negocioId, servicio.Id, empleado.Id, fechaAyer);

        result.Should().BeEmpty("los slots del pasado no deben ofrecerse");
    }

    [Fact]
    public async Task ObtenerSlots_MapeaCorrectamente_DiaDomingoADiaSemana7()
    {
        // DayOfWeek.Sunday == 0 en .NET; el servicio lo mapea a byte 7
        var db = CreateDb();
        var svc = CreateService(db);
        var (negocioId, servicio) = SeedServicio(db, duracionMinutos: 60);
        var empleado = SeedEmpleado(db, negocioId);
        SeedEmpleadoServicio(db, empleado.Id, servicio.Id);
        var domingo = NextWeekday(DayOfWeek.Sunday);
        SeedHorario(db, empleado.Id, diaSemana: 7,
            new TimeSpan(10, 0, 0), new TimeSpan(12, 0, 0));
        await db.SaveChangesAsync();

        var result = await svc.ObtenerSlotsDisponiblesAsync(negocioId, servicio.Id, empleado.Id, domingo);

        result.Should().HaveCount(2, "domingo debe resolverse a DiaSemana=7 y encontrar el horario");
        result[0].HoraTexto.Should().Be("10:00");
        result[1].HoraTexto.Should().Be("11:00");
    }

    // ── Tests — multi-employee path ───────────────────────────────────────────

    [Fact]
    public async Task ObtenerSlots_RetornaVacio_CuandoNingunEmpleadoActivoOfreceElServicio()
    {
        // Empleado desvinculado del servicio → empleadosActivos vacío → lista vacía
        var db = CreateDb();
        var svc = CreateService(db);
        var (negocioId, servicio) = SeedServicio(db, duracionMinutos: 60);
        var empleado = SeedEmpleado(db, negocioId);
        // No SeedEmpleadoServicio → no aparece en EmpleadosServicios
        var fecha = NextWeekday(DayOfWeek.Monday);
        SeedHorario(db, empleado.Id, ToDiaSemana(DayOfWeek.Monday),
            new TimeSpan(9, 0, 0), new TimeSpan(11, 0, 0));
        await db.SaveChangesAsync();

        var result = await svc.ObtenerSlotsDisponiblesAsync(negocioId, servicio.Id, null, fecha);

        result.Should().BeEmpty();
    }

    [Fact]
    public async Task ObtenerSlots_MergeYDeduplica_CuandoDosEmpleadosTienenElMismoSlot()
    {
        // Dos empleados con horario idéntico → DistinctBy(Inicio) debe dejar sólo 1 slot
        var db = CreateDb();
        var svc = CreateService(db);
        var (negocioId, servicio) = SeedServicio(db, duracionMinutos: 60);
        var emp1 = SeedEmpleado(db, negocioId);
        var emp2 = SeedEmpleado(db, negocioId);
        SeedEmpleadoServicio(db, emp1.Id, servicio.Id);
        SeedEmpleadoServicio(db, emp2.Id, servicio.Id);
        var fecha = NextWeekday(DayOfWeek.Monday);
        var dia = ToDiaSemana(DayOfWeek.Monday);
        SeedHorario(db, emp1.Id, dia, new TimeSpan(9, 0, 0), new TimeSpan(10, 0, 0));
        SeedHorario(db, emp2.Id, dia, new TimeSpan(9, 0, 0), new TimeSpan(10, 0, 0));
        await db.SaveChangesAsync();

        var result = await svc.ObtenerSlotsDisponiblesAsync(negocioId, servicio.Id, null, fecha);

        result.Should().HaveCount(1, "DistinctBy(Inicio) debe eliminar el slot duplicado del segundo empleado");
        result[0].HoraTexto.Should().Be("09:00");
    }

    [Fact]
    public async Task ObtenerSlots_IncluirSlotLibre_CuandoUnEmpleadoOcupadoYOtroDisponible()
    {
        // Emp1 con cita en 09:00, Emp2 libre → el slot de 09:00 debe aparecer (del emp2)
        var db = CreateDb();
        var svc = CreateService(db);
        var (negocioId, servicio) = SeedServicio(db, duracionMinutos: 60);
        var emp1 = SeedEmpleado(db, negocioId);
        var emp2 = SeedEmpleado(db, negocioId);
        SeedEmpleadoServicio(db, emp1.Id, servicio.Id);
        SeedEmpleadoServicio(db, emp2.Id, servicio.Id);
        var fecha = NextWeekday(DayOfWeek.Monday);
        var dia = ToDiaSemana(DayOfWeek.Monday);
        SeedHorario(db, emp1.Id, dia, new TimeSpan(9, 0, 0), new TimeSpan(10, 0, 0));
        SeedHorario(db, emp2.Id, dia, new TimeSpan(9, 0, 0), new TimeSpan(10, 0, 0));
        var fechaDt = fecha.ToDateTime(TimeOnly.MinValue);
        // Sólo emp1 tiene cita en ese slot
        SeedCita(db, negocioId, emp1.Id, servicio.Id,
            fechaDt.AddHours(9), fechaDt.AddHours(10), EstadosCitas.Confirmada);
        await db.SaveChangesAsync();

        var result = await svc.ObtenerSlotsDisponiblesAsync(negocioId, servicio.Id, null, fecha);

        result.Should().HaveCount(1, "emp2 tiene el slot libre, debe aparecer aunque emp1 esté ocupado");
        result[0].HoraTexto.Should().Be("09:00");
    }
}
