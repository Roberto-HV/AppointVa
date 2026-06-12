using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Repository.IRepository;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Repository
{
    public class ServicioRepository : IServicioRepository
    {
        private readonly ApplicationDbContext _db;

        public ServicioRepository(ApplicationDbContext db) => _db = db;

        public async Task<List<Servicio>> ObtenerTodosAsync(Guid negocioId, bool incluirInactivos = false)
        {
            var query = _db.Servicios
                .Include(s => s.Categoria)
                .Where(s => s.NegocioId == negocioId && s.FechaEliminacion == null);

            if (!incluirInactivos)
                query = query.Where(s => s.Activo == 1);

            return await query.OrderBy(s => s.Orden).ToListAsync();
        }

        public async Task<Servicio?> ObtenerPorIdAsync(Guid id, Guid negocioId)
        {
            return await _db.Servicios
                .Include(s => s.Categoria)
                .FirstOrDefaultAsync(s => s.Id == id && s.NegocioId == negocioId && s.FechaEliminacion == null);
        }

        public async Task<Servicio> CrearAsync(Servicio servicio)
        {
            await _db.Servicios.AddAsync(servicio);
            await _db.SaveChangesAsync();
            return servicio;
        }

        public async Task<Servicio> ActualizarAsync(Servicio servicio)
        {
            _db.Servicios.Update(servicio);
            await _db.SaveChangesAsync();
            return servicio;
        }

        public async Task EliminarAsync(Guid id, Guid negocioId)
        {
            var servicio = await ObtenerPorIdAsync(id, negocioId);
            if (servicio is null) return;

            servicio.Activo = 0;
            servicio.FechaEliminacion = DateTime.UtcNow;
            servicio.FechaActualizacion = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
    }
}
