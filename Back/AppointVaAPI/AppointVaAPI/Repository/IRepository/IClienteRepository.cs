using AppointVaAPI.Models;

namespace AppointVaAPI.Repository.IRepository
{
    public interface IClienteRepository
    {
        Task<Cliente?> BuscarPorTelefonoAsync(Guid negocioId, string telefono);
        Task<Cliente> ObtenerOCrearAsync(Guid negocioId, string nombreCompleto, string telefono, string? email);
        Task<List<Cliente>> ObtenerTodosAsync(Guid negocioId);
        Task<Cliente?> ObtenerPorIdAsync(Guid id, Guid negocioId);
        Task ActualizarAsync(Cliente cliente);
    }
}
