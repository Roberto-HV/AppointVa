using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Helpers;
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

        // Panel list, detail and agenda: the owner and the employees see every real
        // appointment of their business, a deleted client's included (it still holds its
        // slot). The client is attached apart (ClientesDeCitasHelper): an Include here was
        // an INNER JOIN through the soft-delete filter and dropped those appointments.
        public async Task<List<Cita>> ObtenerCitasAsync(Guid negocioId, DateTime? desde, DateTime? hasta, Guid? empleadoId, string? busqueda = null, byte? estado = null, bool? pagada = null)
        {
            var query = _db.Citas
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
            if (pagada.HasValue)
                query = query.Where(c => c.Pagada == pagada.Value);
            if (!string.IsNullOrWhiteSpace(busqueda))
            {
                var q = busqueda.ToLower();
                // Name and phone are matched in a subquery over the (filtered) Clientes, not
                // through c.Cliente, so the search by code or service still finds the
                // appointments of a deleted client; their name and phone no longer match.
                query = query.Where(c =>
                    _db.Clientes.Any(cl => cl.Id == c.ClienteId &&
                        (cl.NombreCompleto.ToLower().Contains(q) || cl.Telefono.Contains(q))) ||
                    c.CodigoConfirmacion.ToLower().Contains(q) ||
                    c.Servicio!.Nombre.ToLower().Contains(q));
            }

            var citas = await query.OrderBy(c => c.InicioEn).AsNoTracking().ToListAsync();
            await ClientesDeCitasHelper.AdjuntarAsync(_db, citas);
            return citas;
        }

        // Panel detail and every panel action (state, payment, notes, reschedule): a
        // deleted client's appointment is found too, with Cliente null.
        public async Task<Cita?> ObtenerPorIdAsync(Guid id, Guid negocioId)
        {
            var cita = await _db.Citas
                .Include(c => c.Empleado)
                .Include(c => c.Servicio)
                .FirstOrDefaultAsync(c => c.Id == id && c.NegocioId == negocioId);
            return await ClientesDeCitasHelper.AdjuntarAsync(_db, cita);
        }

        // Public lookup by confirmation code (confirmation page, iCal, client cancel and
        // reschedule). Deliberately null for an appointment whose client was deleted: the
        // code alone would otherwise keep exposing that person's booking to whoever holds
        // the link, and cancel/reschedule need the client's email, which is gone. The
        // business still sees and manages the appointment from the panel.
        public async Task<Cita?> ObtenerPorCodigoAsync(string codigo)
        {
            var cita = await _db.Citas
                .Include(c => c.Empleado)
                .Include(c => c.Servicio)
                .Include(c => c.Negocio)
                .FirstOrDefaultAsync(c => c.CodigoConfirmacion == codigo);
            await ClientesDeCitasHelper.AdjuntarAsync(_db, cita);
            return cita?.Cliente is null ? null : cita;
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
