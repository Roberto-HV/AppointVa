using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Repository.IRepository;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Repository
{
    public class ClienteRepository : IClienteRepository
    {
        private readonly ApplicationDbContext _db;

        public ClienteRepository(ApplicationDbContext db)
        {
            _db = db;
        }

        public async Task<Cliente?> BuscarPorTelefonoAsync(Guid negocioId, string telefono)
        {
            return await _db.Clientes
                .FirstOrDefaultAsync(c => c.NegocioId == negocioId && c.Telefono == telefono);
        }

        public async Task<Cliente> ObtenerOCrearAsync(Guid negocioId, string nombreCompleto, string telefono, string? email)
        {
            var existente = await BuscarPorTelefonoAsync(negocioId, telefono);
            if (existente is not null)
            {
                // Actualizar nombre/email si cambió
                existente.NombreCompleto = nombreCompleto;
                if (!string.IsNullOrWhiteSpace(email))
                    existente.Email = email;
                existente.FechaActualizacion = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return existente;
            }

            var nuevo = new Cliente
            {
                Id = Guid.NewGuid(),
                NegocioId = negocioId,
                NombreCompleto = nombreCompleto,
                Telefono = telefono,
                Email = email,
                TotalCitas = 0,
                CantidadInasistencias = 0,
                FechaCreacion = DateTime.UtcNow,
                FechaActualizacion = DateTime.UtcNow
            };

            _db.Clientes.Add(nuevo);
            await _db.SaveChangesAsync();
            return nuevo;
        }

        public async Task<List<Cliente>> ObtenerTodosAsync(Guid negocioId)
        {
            return await _db.Clientes
                .Where(c => c.NegocioId == negocioId)
                .OrderBy(c => c.NombreCompleto)
                .ToListAsync();
        }

        public async Task<Cliente?> ObtenerPorIdAsync(Guid id, Guid negocioId)
        {
            return await _db.Clientes
                .FirstOrDefaultAsync(c => c.Id == id && c.NegocioId == negocioId);
        }

        public async Task ActualizarAsync(Cliente cliente)
        {
            _db.Clientes.Update(cliente);
            await _db.SaveChangesAsync();
        }
    }
}
