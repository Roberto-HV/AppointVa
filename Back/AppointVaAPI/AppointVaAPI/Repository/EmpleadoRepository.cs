using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Repository.IRepository;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Repository
{
    public class EmpleadoRepository : IEmpleadoRepository
    {
        private readonly ApplicationDbContext _db;

        public EmpleadoRepository(ApplicationDbContext db) => _db = db;

        public async Task<List<Empleado>> ObtenerTodosAsync(Guid negocioId, bool incluirInactivos = false)
        {
            var query = _db.Empleados
                .Where(e => e.NegocioId == negocioId && e.FechaEliminacion == null);

            if (!incluirInactivos)
                query = query.Where(e => e.Activo == 1);

            return await query.OrderBy(e => e.Nombre).ToListAsync();
        }

        public async Task<Empleado?> ObtenerPorIdAsync(Guid id, Guid negocioId)
        {
            return await _db.Empleados
                .FirstOrDefaultAsync(e => e.Id == id && e.NegocioId == negocioId && e.FechaEliminacion == null);
        }

        public async Task<Empleado> CrearAsync(Empleado empleado)
        {
            await _db.Empleados.AddAsync(empleado);
            await _db.SaveChangesAsync();
            return empleado;
        }

        public async Task<Empleado> ActualizarAsync(Empleado empleado)
        {
            _db.Empleados.Update(empleado);
            await _db.SaveChangesAsync();
            return empleado;
        }

        public async Task EliminarAsync(Guid id, Guid negocioId)
        {
            var empleado = await ObtenerPorIdAsync(id, negocioId);
            if (empleado is null) return;

            empleado.Activo = 0;
            empleado.FechaEliminacion = DateTime.UtcNow;
            empleado.FechaActualizacion = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        public async Task<List<Guid>> ObtenerServicioIdsAsync(Guid empleadoId)
        {
            return await _db.EmpleadosServicios
                .Where(es => es.EmpleadoId == empleadoId)
                .Select(es => es.ServicioId)
                .ToListAsync();
        }

        public async Task<Dictionary<Guid, List<Guid>>> ObtenerServicioIdsBatchAsync(IEnumerable<Guid> empleadoIds)
        {
            var ids = empleadoIds.ToList();
            var relaciones = await _db.EmpleadosServicios
                .Where(es => ids.Contains(es.EmpleadoId))
                .Select(es => new { es.EmpleadoId, es.ServicioId })
                .ToListAsync();

            return ids.ToDictionary(
                id => id,
                id => relaciones.Where(r => r.EmpleadoId == id).Select(r => r.ServicioId).ToList()
            );
        }

        public async Task ActualizarServiciosAsync(Guid empleadoId, List<Guid> servicioIds)
        {
            var existentes = await _db.EmpleadosServicios
                .Where(es => es.EmpleadoId == empleadoId)
                .ToListAsync();

            _db.EmpleadosServicios.RemoveRange(existentes);

            var nuevos = servicioIds.Select(sid => new EmpleadoServicio
            {
                EmpleadoId = empleadoId,
                ServicioId = sid
            });

            await _db.EmpleadosServicios.AddRangeAsync(nuevos);
            await _db.SaveChangesAsync();
        }

        public async Task<List<HorarioEmpleado>> ObtenerHorariosAsync(Guid empleadoId, Guid negocioId)
        {
            // Verificar que el empleado pertenece al negocio
            var existe = await _db.Empleados
                .AnyAsync(e => e.Id == empleadoId && e.NegocioId == negocioId);

            if (!existe) return [];

            return await _db.HorariosEmpleados
                .Where(h => h.EmpleadoId == empleadoId)
                .OrderBy(h => h.DiaSemana)
                .ToListAsync();
        }

        public async Task ActualizarHorariosAsync(Guid empleadoId, Guid negocioId, List<HorarioEmpleado> horarios)
        {
            var existentes = await _db.HorariosEmpleados
                .Where(h => h.EmpleadoId == empleadoId)
                .ToListAsync();

            _db.HorariosEmpleados.RemoveRange(existentes);
            await _db.HorariosEmpleados.AddRangeAsync(horarios);
            await _db.SaveChangesAsync();
        }

        public async Task<List<BloqueoHorario>> ObtenerBloqueosAsync(Guid empleadoId, Guid negocioId)
        {
            var existe = await _db.Empleados
                .AnyAsync(e => e.Id == empleadoId && e.NegocioId == negocioId);

            if (!existe) return [];

            return await _db.BloqueosHorarios
                .Where(b => b.EmpleadoId == empleadoId && b.FinEn >= DateTime.UtcNow)
                .OrderBy(b => b.InicioEn)
                .ToListAsync();
        }

        public async Task<BloqueoHorario> CrearBloqueoAsync(BloqueoHorario bloqueo)
        {
            await _db.BloqueosHorarios.AddAsync(bloqueo);
            await _db.SaveChangesAsync();
            return bloqueo;
        }

        public async Task EliminarBloqueoAsync(Guid bloqueoId, Guid negocioId)
        {
            var bloqueo = await _db.BloqueosHorarios
                .Include(b => b.Empleado)
                .FirstOrDefaultAsync(b => b.Id == bloqueoId && b.Empleado!.NegocioId == negocioId);

            if (bloqueo is null) return;

            _db.BloqueosHorarios.Remove(bloqueo);
            await _db.SaveChangesAsync();
        }
    }
}
