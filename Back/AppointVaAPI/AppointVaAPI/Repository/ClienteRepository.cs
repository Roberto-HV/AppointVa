using AppointVaAPI.Data;
using AppointVaAPI.Helpers;
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

        public async Task<Cliente?> BuscarPorTelefonoAsync(Guid negocioId, string? telefono)
        {
            if (string.IsNullOrWhiteSpace(telefono)) return null;

            // Las filas antiguas pueden tener el teléfono con espacios o guiones, así que
            // se compara contra el valor tal cual y contra su forma sólo-dígitos. Ambos son
            // predicados de igualdad, por lo que el índice único (NegocioId, Telefono) sigue sirviendo.
            var digitos = NormalizacionHelper.SoloDigitos(telefono);
            return await _db.Clientes
                .FirstOrDefaultAsync(c => c.NegocioId == negocioId
                                       && (c.Telefono == telefono || c.Telefono == digitos)
                                       && c.FechaEliminacion == null);
        }

        public async Task<ResolucionCliente> ObtenerOCrearAsync(
            Guid negocioId,
            string nombreCompleto,
            string? telefono,
            string? email,
            bool aceptarClienteExistente = false)
        {
            // Only look up by phone when one is provided
            if (!string.IsNullOrWhiteSpace(telefono))
            {
                var existente = await BuscarPorTelefonoAsync(negocioId, telefono);
                if (existente is not null)
                {
                    var mismoNombre = NormalizacionHelper.MismoNombre(existente.NombreCompleto, nombreCompleto);
                    if (!mismoNombre && !aceptarClienteExistente)
                        return new ResolucionCliente(ResultadoResolucionCliente.ConflictoNombre, existente);

                    // El nombre registrado se conserva aunque el solicitante envíe otro.
                    if (!string.IsNullOrWhiteSpace(email) && string.IsNullOrWhiteSpace(existente.Email))
                        existente.Email = email;
                    existente.FechaActualizacion = DateTime.UtcNow;
                    await _db.SaveChangesAsync();
                    return new ResolucionCliente(ResultadoResolucionCliente.Encontrado, existente);
                }
            }

            var nuevo = new Cliente
            {
                Id = Guid.NewGuid(),
                NegocioId = negocioId,
                NombreCompleto = nombreCompleto,
                // Se guarda sólo-dígitos para que los datos converjan sin migración.
                Telefono = string.IsNullOrWhiteSpace(telefono)
                    ? null
                    : NormalizacionHelper.SoloDigitos(telefono),
                Email = email,
                TotalCitas = 0,
                CantidadInasistencias = 0,
                FechaCreacion = DateTime.UtcNow,
                FechaActualizacion = DateTime.UtcNow
            };

            _db.Clientes.Add(nuevo);
            await _db.SaveChangesAsync();
            return new ResolucionCliente(ResultadoResolucionCliente.Creado, nuevo);
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

        public async Task<bool> EliminarAsync(Guid id, Guid negocioId)
        {
            var cliente = await ObtenerPorIdAsync(id, negocioId);
            if (cliente is null) return false;
            cliente.FechaEliminacion = DateTime.UtcNow;
            cliente.FechaActualizacion = DateTime.UtcNow;
            _db.Clientes.Update(cliente);
            await _db.SaveChangesAsync();
            return true;
        }
    }
}
