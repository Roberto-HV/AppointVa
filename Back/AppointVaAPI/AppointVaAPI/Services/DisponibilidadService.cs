using AppointVaAPI.Constants;
using AppointVaAPI.Data;
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

        public async Task<List<SlotDisponibleDto>> ObtenerSlotsDisponiblesAsync(
            Guid negocioId, Guid servicioId, Guid? empleadoId, DateOnly fecha)
        {
            var fechaDt = fecha.ToDateTime(TimeOnly.MinValue);
            var finDia = fechaDt.AddDays(1);

            // Si el día está bloqueado para el negocio, no hay slots
            var diaBloquedo = await _db.BloqueosNegocio
                .AnyAsync(b => b.NegocioId == negocioId && b.Fecha.Date == fechaDt.Date);
            if (diaBloquedo) return new();

            var servicio = await _db.Servicios
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == servicioId && s.NegocioId == negocioId && s.Activo == 1);
            if (servicio is null) return new();

            var diaSemana = (byte)(fechaDt.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)fechaDt.DayOfWeek);

            if (empleadoId.HasValue)
            {
                var slots = await ObtenerSlotsEmpleadoAsync(servicio, empleadoId.Value, fecha, fechaDt, finDia, diaSemana);
                foreach (var s in slots) s.EmpleadoId = empleadoId;
                return slots;
            }

            // Sin preferencia: cargar en batch todos los empleados que ofrecen el servicio
            var empleadosIds = await _db.EmpleadosServicios
                .Where(es => es.ServicioId == servicioId)
                .Select(es => es.EmpleadoId)
                .ToListAsync();

            var empleadosActivos = await _db.Empleados
                .Where(e => e.NegocioId == negocioId && e.Activo == 1 && e.FechaEliminacion == null
                            && empleadosIds.Contains(e.Id))
                .Select(e => new { e.Id, e.Nombre })
                .AsNoTracking()
                .ToListAsync();

            if (empleadosActivos.Count == 0) return new();

            var empIds = empleadosActivos.Select(e => e.Id).ToList();

            // Cargar horarios, citas y bloqueos de todos los empleados de una sola vez
            var horarios = await _db.HorariosEmpleados
                .Where(h => empIds.Contains(h.EmpleadoId) && h.DiaSemana == diaSemana && h.Activo == 1)
                .AsNoTracking()
                .ToListAsync();

            var citasDelDia = await _db.Citas
                .Where(c => empIds.Contains(c.EmpleadoId) &&
                            (c.Estado == EstadosCitas.Pendiente || c.Estado == EstadosCitas.Confirmada) &&
                            c.InicioEn >= fechaDt && c.InicioEn < finDia)
                .Select(c => new { c.EmpleadoId, c.InicioEn, c.FinEn })
                .AsNoTracking()
                .ToListAsync();

            var bloqueosDelDia = await _db.BloqueosHorarios
                .Where(b => empIds.Contains(b.EmpleadoId) && b.InicioEn < finDia && b.FinEn > fechaDt)
                .Select(b => new { b.EmpleadoId, b.InicioEn, b.FinEn })
                .AsNoTracking()
                .ToListAsync();

            var duracion = TimeSpan.FromMinutes(servicio.DuracionMinutos);
            var buffer = TimeSpan.FromMinutes(servicio.BufferMinutos);
            var ahora = DateTime.UtcNow;
            var todos = new List<SlotDisponibleDto>();

            foreach (var emp in empleadosActivos)
            {
                var horario = horarios.FirstOrDefault(h => h.EmpleadoId == emp.Id);
                if (horario is null) continue;

                var citasEmp = citasDelDia.Where(c => c.EmpleadoId == emp.Id).ToList();
                var bloqueosEmp = bloqueosDelDia.Where(b => b.EmpleadoId == emp.Id).ToList();

                var slotInicio = fechaDt.Add(horario.HoraInicio);
                var horarioFin = fechaDt.Add(horario.HoraFin);

                while (slotInicio + duracion <= horarioFin)
                {
                    var slotFin = slotInicio + duracion;
                    // La cita "ocupa" desde InicioEn hasta FinEn + buffer
                    var solapaCita = citasEmp.Any(c => c.InicioEn < slotFin && c.FinEn.Add(buffer) > slotInicio);
                    var solapaBloqueo = bloqueosEmp.Any(b => b.InicioEn < slotFin && b.FinEn > slotInicio);

                    if (!solapaCita && !solapaBloqueo && slotInicio > ahora)
                    {
                        todos.Add(new SlotDisponibleDto
                        {
                            Inicio = slotInicio,
                            Fin = slotFin,
                            HoraTexto = slotInicio.ToString("HH:mm"),
                            EmpleadoId = emp.Id,
                            EmpleadoNombre = emp.Nombre
                        });
                    }
                    slotInicio = slotInicio.Add(duracion);
                }
            }

            return todos.OrderBy(s => s.Inicio).DistinctBy(s => s.Inicio).ToList();
        }

        private async Task<List<SlotDisponibleDto>> ObtenerSlotsEmpleadoAsync(
            AppointVaAPI.Models.Servicio servicio, Guid empleadoId,
            DateOnly fecha, DateTime fechaDt, DateTime finDia, byte diaSemana)
        {
            var empleadoOfreceServicio = await _db.EmpleadosServicios
                .AnyAsync(es => es.EmpleadoId == empleadoId && es.ServicioId == servicio.Id);
            if (!empleadoOfreceServicio) return new();

            var horario = await _db.HorariosEmpleados
                .AsNoTracking()
                .FirstOrDefaultAsync(h => h.EmpleadoId == empleadoId && h.DiaSemana == diaSemana && h.Activo == 1);
            if (horario is null) return new();

            var citasExistentes = await _db.Citas
                .Where(c =>
                    c.EmpleadoId == empleadoId &&
                    (c.Estado == EstadosCitas.Pendiente || c.Estado == EstadosCitas.Confirmada) &&
                    c.InicioEn >= fechaDt && c.InicioEn < finDia)
                .Select(c => new { c.InicioEn, c.FinEn })
                .AsNoTracking()
                .ToListAsync();

            var bloqueosExistentes = await _db.BloqueosHorarios
                .Where(b => b.EmpleadoId == empleadoId && b.InicioEn < finDia && b.FinEn > fechaDt)
                .Select(b => new { b.InicioEn, b.FinEn })
                .AsNoTracking()
                .ToListAsync();

            var duracion = TimeSpan.FromMinutes(servicio.DuracionMinutos);
            var buffer = TimeSpan.FromMinutes(servicio.BufferMinutos);
            var ahora = DateTime.UtcNow;
            var slots = new List<SlotDisponibleDto>();

            var slotInicio = fechaDt.Add(horario.HoraInicio);
            var horarioFin = fechaDt.Add(horario.HoraFin);

            while (slotInicio + duracion <= horarioFin)
            {
                var slotFin = slotInicio + duracion;
                var solapaCita = citasExistentes.Any(c => c.InicioEn < slotFin && c.FinEn.Add(buffer) > slotInicio);
                var solapaBloqueo = bloqueosExistentes.Any(b => b.InicioEn < slotFin && b.FinEn > slotInicio);

                if (!solapaCita && !solapaBloqueo && slotInicio > ahora)
                {
                    slots.Add(new SlotDisponibleDto
                    {
                        Inicio = slotInicio,
                        Fin = slotFin,
                        HoraTexto = slotInicio.ToString("HH:mm")
                    });
                }
                slotInicio = slotInicio.Add(duracion);
            }

            return slots;
        }
    }
}
