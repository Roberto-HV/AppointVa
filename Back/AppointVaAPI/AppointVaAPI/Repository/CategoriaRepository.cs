using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Repository.IRepository;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Repository
{
    public class CategoriaRepository : ICategoriaRepository
    {
        private readonly ApplicationDbContext _db;

        public CategoriaRepository(ApplicationDbContext db) => _db = db;

        public async Task<List<CategoriaServicio>> ObtenerTodosAsync(Guid negocioId)
        {
            return await _db.CategoriasServicios
                .Where(c => c.NegocioId == negocioId && c.Activo == 1)
                .OrderBy(c => c.Orden)
                .ToListAsync();
        }

        public async Task<CategoriaServicio?> ObtenerPorIdAsync(Guid id, Guid negocioId)
        {
            return await _db.CategoriasServicios
                .FirstOrDefaultAsync(c => c.Id == id && c.NegocioId == negocioId);
        }

        public async Task<CategoriaServicio> CrearAsync(CategoriaServicio categoria)
        {
            await _db.CategoriasServicios.AddAsync(categoria);
            await _db.SaveChangesAsync();
            return categoria;
        }

        public async Task<CategoriaServicio> ActualizarAsync(CategoriaServicio categoria)
        {
            _db.CategoriasServicios.Update(categoria);
            await _db.SaveChangesAsync();
            return categoria;
        }

        public async Task EliminarAsync(Guid id, Guid negocioId)
        {
            var categoria = await ObtenerPorIdAsync(id, negocioId);
            if (categoria is null) return;

            categoria.Activo = 0;
            await _db.SaveChangesAsync();
        }
    }
}
