using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Repository.IRepository;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Repository
{
    public class CitaRepository : ICitaRepository
    {
        private readonly ApplicationDbContext _db;

        public CitaRepository(ApplicationDbContext db)
        {
            _db = db;
        }

        public async Task<List<Cita>> ObtenerCitasAsync(Guid negocioId, DateTime? desde, DateTime? hasta, Guid? empleadoId, string? busqueda = null, byte? estado = null)
        {
            var query = _db.Citas
                .Include(c => c.Cliente)
                .Include(c => c.Empleado)
                .Include(c => c.Servicio)
                .Where(c => c.NegocioId == negocioId);

            if (desde.HasValue)
                query = query.Where(c => c.InicioEn >= desde.Value);
            if (hasta.HasValue)
                query = query.Where(c => c.InicioEn <= hasta.Value);
            if (empleadoId.HasValue)
                query = query.Where(c => c.EmpleadoId == empleadoId.Value);
            if (estado.HasValue)
                query = query.Where(c => c.Estado == estado.Value);
            if (!string.IsNullOrWhiteSpace(busqueda))
            {
                var q = busqueda.ToLower();
                query = query.Where(c =>
                    c.Cliente!.NombreCompleto.ToLower().Contains(q) ||
                    c.Cliente.Telefono.Contains(q) ||
                    c.CodigoConfirmacion.ToLower().Contains(q) ||
                    c.Servicio!.Nombre.ToLower().Contains(q));
            }

            return await query.OrderBy(c => c.InicioEn).AsNoTracking().ToListAsync();
        }

        public async Task<Cita?> ObtenerPorIdAsync(Guid id, Guid negocioId)
        {
            return await _db.Citas
                .Include(c => c.Cliente)
                .Include(c => c.Empleado)
                .Include(c => c.Servicio)
                .FirstOrDefaultAsync(c => c.Id == id && c.NegocioId == negocioId);
        }

        public async Task<Cita?> ObtenerPorCodigoAsync(string codigo)
        {
            return await _db.Citas
                .Include(c => c.Cliente)
                .Include(c => c.Empleado)
                .Include(c => c.Servicio)
                .Include(c => c.Negocio)
                .FirstOrDefaultAsync(c => c.CodigoConfirmacion == codigo);
        }

        public async Task<Cita> CrearAsync(Cita cita)
        {
            _db.Citas.Add(cita);
            await _db.SaveChangesAsync();
            return cita;
        }

        public async Task ActualizarAsync(Cita cita)
        {
            _db.Citas.Update(cita);
            await _db.SaveChangesAsync();
        }

        public async Task<bool> ExisteSolapamientoAsync(Guid empleadoId, DateTime inicio, DateTime fin, Guid? excluirCitaId = null)
        {
            var query = _db.Citas.Where(c =>
                c.EmpleadoId == empleadoId &&
                (c.Estado == EstadosCitas.Pendiente || c.Estado == EstadosCitas.Confirmada) &&
                c.InicioEn < fin && c.FinEn > inicio);

            if (excluirCitaId.HasValue)
                query = query.Where(c => c.Id != excluirCitaId.Value);

            return await query.AnyAsync();
        }

        public async Task<List<Cita>> ObtenerCitasEmpleadoEnFechaAsync(Guid empleadoId, DateTime inicioDia, DateTime finDia)
        {
            return await _db.Citas
                .Where(c =>
                    c.EmpleadoId == empleadoId &&
                    (c.Estado == EstadosCitas.Pendiente || c.Estado == EstadosCitas.Confirmada) &&
                    c.InicioEn >= inicioDia && c.InicioEn < finDia)
                .ToListAsync();
        }
    }
}
