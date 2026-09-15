using AppointVaAPI.Models;

namespace AppointVaAPI.Repository.IRepository
{
    public interface IClienteRepository
    {
        Task<Cliente?> BuscarPorTelefonoAsync(Guid negocioId, string? telefono);

        /// <summary>
        /// Resuelve el cliente de una reserva a partir del teléfono.
        /// Si el teléfono ya está registrado con otro nombre devuelve
        /// <see cref="ResultadoResolucionCliente.ConflictoNombre"/> sin tocar la base,
        /// salvo que <paramref name="aceptarClienteExistente"/> sea true, en cuyo caso
        /// se reutiliza el cliente y se conserva el nombre ya registrado.
        /// </summary>
        Task<ResolucionCliente> ObtenerOCrearAsync(
            Guid negocioId,
            string nombreCompleto,
            string? telefono,
            string? email,
            bool aceptarClienteExistente = false);
        Task<List<Cliente>> ObtenerTodosAsync(Guid negocioId);
        Task<Cliente?> ObtenerPorIdAsync(Guid id, Guid negocioId);
        Task ActualizarAsync(Cliente cliente);
        Task<bool> EliminarAsync(Guid id, Guid negocioId);
    }
}
