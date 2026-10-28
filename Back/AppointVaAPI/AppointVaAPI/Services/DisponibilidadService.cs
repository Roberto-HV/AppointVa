using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Helpers;
using AppointVaAPI.Models.Dtos.Publico;
using AppointVaAPI.Services.IServices;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Services
{
    public class DisponibilidadService : IDisponibilidadService
    {
        private readonly ApplicationDbContext _db;

        public DisponibilidadService(ApplicationDbContext db)
        {
            _db = db;
        }

        // ── Data the pure per-day calculation works on ───────────────────────────
        internal sealed record EmpleadoDisponible(Guid Id, string Nombre);
        internal sealed record IntervaloHorario(Guid EmpleadoId, byte DiaSemana, TimeSpan HoraInicio, TimeSpan HoraFin);
        internal sealed record Ocupacion(Guid EmpleadoId, DateTime InicioEn, DateTime FinEn);

        internal sealed class DatosRango
        {
            public required HashSet<DateOnly> DiasBloqueados { get; init; }
            public required List<EmpleadoDisponible> Empleados { get; init; }
            /// <summary>Employee intervals; DiaSemana 1=Mon … 7=Sun.</summary>
            public required List<IntervaloHorario> HorariosEmpleados { get; init; }
            /// <summary>Business intervals; DiaSemana 0=Sun … 6=Sat. EmpleadoId is unused.</summary>
            public required List<IntervaloHorario> HorariosNegocio { get; init; }
            public required List<Ocupacion> Citas { get; init; }
            public required List<Ocupacion> Bloqueos { get; init; }
            public required TimeSpan Duracion { get; init; }
            public required TimeSpan Buffer { get; init; }
            public required TimeZoneInfo Tz { get; init; }
            /// <summary>True when the visitor picked a specific employee: no merge/dedupe across employees.</summary>
            public required bool EmpleadoElegido { get; init; }
        }

        public async Task<List<SlotDisponibleDto>> ObtenerSlotsDisponiblesAsync(
            Guid negocioId, Guid servicioId, Guid? empleadoId, DateOnly fecha)
        {
            var dias = await ObtenerSlotsRangoAsync(negocioId, servicioId, empleadoId, fecha, 1);
            return dias[0].Horarios;
        }

        public async Task<List<DiaDisponibilidadDto>> ObtenerSlotsRangoAsync(
            Guid negocioId, Guid servicioId, Guid? empleadoId, DateOnly desde, int dias)
        {
            if (dias < 1) throw new ArgumentOutOfRangeException(nameof(dias));

            var fechas = Enumerable.Range(0, dias).Select(desde.AddDays).ToList();
            var datos = await CargarDatosRangoAsync(negocioId, servicioId, empleadoId, desde, dias);
            var ahoraUtc = DateTimeOffset.UtcNow;

            if (datos is null)
                return fechas.Select(f => new DiaDisponibilidadDto
                {
                    Fecha = f.ToString("yyyy-MM-dd"),
                    Estado = EstadosDiaDisponibilidad.SinHorarios
                }).ToList();

            return fechas.Select(f => CalcularDia(f, datos, ahoraUtc)).ToList();
        }

        /// <summary>
        /// Loads everything the range needs in a fixed number of queries, independent of
        /// the number of days. Returns null when the service does not exist for the business.
        /// </summary>
        private async Task<DatosRango?> CargarDatosRangoAsync(
            Guid negocioId, Guid servicioId, Guid? empleadoId, DateOnly desde, int dias)
        {
            var inicioRango = desde.ToDateTime(TimeOnly.MinValue);
            var finRango = inicioRango.AddDays(dias);

            var servicio = await _db.Servicios
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == servicioId && s.NegocioId == negocioId && s.Activo == 1);
            if (servicio is null) return null;

            var negocioTz = await _db.Negocios
                .Where(n => n.Id == negocioId)
                .Select(n => n.ZonaHoraria)
                .AsNoTracking()
                .FirstOrDefaultAsync();
            var tz = ZonaHorariaHelper.Resolver(negocioTz);

            var fechasBloqueadas = await _db.BloqueosNegocio
                .Where(b => b.NegocioId == negocioId && b.Fecha >= inicioRango && b.Fecha < finRango)
                .Select(b => b.Fecha)
                .ToListAsync();

            // Employees that offer the service: either the one the visitor picked, or all of them.
            var empleadosQuery = _db.Empleados
                .Where(e => e.NegocioId == negocioId && e.Activo == 1 && e.FechaEliminacion == null
                            && _db.EmpleadosServicios.Any(es => es.EmpleadoId == e.Id && es.ServicioId == servicioId));
            if (empleadoId.HasValue)
                empleadosQuery = empleadosQuery.Where(e => e.Id == empleadoId.Value);

            var empleados = await empleadosQuery
                .Select(e => new EmpleadoDisponible(e.Id, e.Nombre))
                .AsNoTracking()
                .ToListAsync();
            var empIds = empleados.Select(e => e.Id).ToList();

            var horariosNegocio = await _db.HorariosNegocios
                .Where(h => h.NegocioId == negocioId && h.Activo == 1)
                .OrderBy(h => h.HoraInicio)
                .Select(h => new IntervaloHorario(Guid.Empty, h.DiaSemana, h.HoraInicio, h.HoraFin))
                .AsNoTracking()
                .ToListAsync();

            List<IntervaloHorario> horariosEmpleados = new();
            List<Ocupacion> citas = new();
            List<Ocupacion> bloqueos = new();
            if (empIds.Count > 0)
            {
                horariosEmpleados = await _db.HorariosEmpleados
                    .Where(h => empIds.Contains(h.EmpleadoId) && h.Activo == 1)
                    .OrderBy(h => h.HoraInicio)
                    .Select(h => new IntervaloHorario(h.EmpleadoId, h.DiaSemana, h.HoraInicio, h.HoraFin))
                    .AsNoTracking()
                    .ToListAsync();

                citas = await _db.Citas
                    .Where(c => empIds.Contains(c.EmpleadoId) &&
                                (c.Estado == EstadosCitas.Pendiente || c.Estado == EstadosCitas.Confirmada) &&
                                c.InicioEn >= inicioRango && c.InicioEn < finRango)
                    .Select(c => new Ocupacion(c.EmpleadoId, c.InicioEn, c.FinEn))
                    .AsNoTracking()
                    .ToListAsync();

                bloqueos = await _db.BloqueosHorarios
                    .Where(b => empIds.Contains(b.EmpleadoId) && b.InicioEn < finRango && b.FinEn > inicioRango)
                    .Select(b => new Ocupacion(b.EmpleadoId, b.InicioEn, b.FinEn))
                    .AsNoTracking()
                    .ToListAsync();
            }

            return new DatosRango
            {
                DiasBloqueados = fechasBloqueadas.Select(DateOnly.FromDateTime).ToHashSet(),
                Empleados = empleados,
                HorariosEmpleados = horariosEmpleados,
                HorariosNegocio = horariosNegocio,
                Citas = citas,
                Bloqueos = bloqueos,
                Duracion = TimeSpan.FromMinutes(servicio.DuracionMinutos),
                Buffer = TimeSpan.FromMinutes(servicio.BufferMinutos),
                Tz = tz,
                EmpleadoElegido = empleadoId.HasValue,
            };
        }

        /// <summary>Pure: computes one day's slots and state from data already in memory.</summary>
        internal static DiaDisponibilidadDto CalcularDia(DateOnly fecha, DatosRango datos, DateTimeOffset ahoraUtc)
        {
            var dia = new DiaDisponibilidadDto { Fecha = fecha.ToString("yyyy-MM-dd") };
            var fechaDt = fecha.ToDateTime(TimeOnly.MinValue);
            var finDia = fechaDt.AddDays(1);

            // Business intervals use 0=Sunday … 6=Saturday.
            var diaSemanaNegocio = (byte)(int)fechaDt.DayOfWeek;
            var intervalosNegocio = datos.HorariosNegocio.Where(h => h.DiaSemana == diaSemanaNegocio).ToList();

            if (datos.DiasBloqueados.Contains(fecha) || intervalosNegocio.Count == 0)
            {
                dia.Estado = EstadosDiaDisponibilidad.Cerrado;
                return dia;
            }

            // Employee intervals use 1=Monday … 7=Sunday.
            var diaSemanaEmpleado = (byte)(fechaDt.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)fechaDt.DayOfWeek);
            var slots = new List<SlotDisponibleDto>();

            foreach (var emp in datos.Empleados)
            {
                var intervalosEmp = datos.HorariosEmpleados
                    .Where(h => h.EmpleadoId == emp.Id && h.DiaSemana == diaSemanaEmpleado);
                var citasEmp = datos.Citas
                    .Where(c => c.EmpleadoId == emp.Id && c.InicioEn >= fechaDt && c.InicioEn < finDia)
                    .ToList();
                var bloqueosEmp = datos.Bloqueos
                    .Where(b => b.EmpleadoId == emp.Id && b.InicioEn < finDia && b.FinEn > fechaDt)
                    .ToList();

                foreach (var intervalo in intervalosEmp)
                {
                    var slotInicio = fechaDt.Add(intervalo.HoraInicio);
                    var slotMax    = fechaDt.Add(intervalo.HoraFin);

                    while (slotInicio + datos.Duracion <= slotMax)
                    {
                        var slotFin = slotInicio + datos.Duracion;

                        // The slot must fall entirely inside at least one business interval.
                        var dentroNegocio = intervalosNegocio.Any(n =>
                            slotInicio >= fechaDt.Add(n.HoraInicio) &&
                            slotFin    <= fechaDt.Add(n.HoraFin));

                        if (dentroNegocio)
                        {
                            // An appointment "occupies" from InicioEn to FinEn + buffer.
                            var solapaCita    = citasEmp.Any(c => c.InicioEn < slotFin && c.FinEn.Add(datos.Buffer) > slotInicio);
                            var solapaBloqueo = bloqueosEmp.Any(b => b.InicioEn < slotFin && b.FinEn > slotInicio);

                            if (!solapaCita && !solapaBloqueo && ZonaHorariaHelper.ToDateTimeOffset(slotInicio, datos.Tz) > ahoraUtc)
                            {
                                slots.Add(new SlotDisponibleDto
                                {
                                    Inicio = slotInicio,
                                    Fin = slotFin,
                                    HoraTexto = Hora12(slotInicio),
                                    EmpleadoId = emp.Id,
                                    EmpleadoNombre = emp.Nombre
                                });
                            }
                        }

                        slotInicio = slotInicio.Add(datos.Duracion);
                    }
                }
            }

            // "Any employee": one entry per start time, the first employee free at that time.
            dia.Horarios = datos.EmpleadoElegido
                ? slots
                : slots.OrderBy(s => s.Inicio).DistinctBy(s => s.Inicio).ToList();
            dia.Estado = dia.Horarios.Count > 0
                ? EstadosDiaDisponibilidad.ConHorarios
                : EstadosDiaDisponibilidad.SinHorarios;
            return dia;
        }

        private static string Hora12(DateTime dt) =>
            dt.ToString("h:mm tt", System.Globalization.CultureInfo.InvariantCulture).ToLower();
    }
}
