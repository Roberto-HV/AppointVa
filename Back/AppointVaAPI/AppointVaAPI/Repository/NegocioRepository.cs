using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Repository.IRepository;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Repository
{
    public class NegocioRepository : INegocioRepository
    {
        private readonly ApplicationDbContext _db;

        public NegocioRepository(ApplicationDbContext db) => _db = db;

        public async Task<Negocio?> ObtenerPorIdAsync(Guid id)
        {
            return await _db.Negocios
                .Include(n => n.Plan)
                .FirstOrDefaultAsync(n => n.Id == id && n.FechaEliminacion == null);
        }

        public async Task<Negocio?> ObtenerPorSlugAsync(string slug)
        {
            return await _db.Negocios
                .Include(n => n.Plan)
                .FirstOrDefaultAsync(n => n.Slug == slug && n.FechaEliminacion == null);
        }

        public async Task<List<Negocio>> ObtenerTodosAsync()
        {
            return await _db.Negocios
                .Include(n => n.Plan)
                .Where(n => n.FechaEliminacion == null)
                .OrderBy(n => n.Nombre)
                .ToListAsync();
        }

        public async Task<Negocio> CrearAsync(Negocio negocio)
        {
            await _db.Negocios.AddAsync(negocio);
            await _db.SaveChangesAsync();
            return negocio;
        }

        public async Task<Negocio> ActualizarAsync(Negocio negocio)
        {
            _db.Negocios.Update(negocio);
            await _db.SaveChangesAsync();
            return negocio;
        }

        public async Task EliminarAsync(Negocio negocio)
        {
            negocio.FechaEliminacion = DateTime.UtcNow;
            negocio.Activo = 0;
            _db.Negocios.Update(negocio);
            await _db.SaveChangesAsync();
        }

        public async Task<bool> SlugExisteAsync(string slug, Guid? excluirId = null)
        {
            var query = _db.Negocios.Where(n => n.Slug == slug && n.FechaEliminacion == null);
            if (excluirId.HasValue)
                query = query.Where(n => n.Id != excluirId.Value);
            return await query.AnyAsync();
        }
    }
}
