using AppointVaAPI.Models;

namespace AppointVaAPI.Repository.IRepository
{
    public interface IServicioRepository
    {
        Task<List<Servicio>> ObtenerTodosAsync(Guid negocioId, bool incluirInactivos = false);
        Task<Servicio?> ObtenerPorIdAsync(Guid id, Guid negocioId);
        Task<Servicio> CrearAsync(Servicio servicio);
        Task<Servicio> ActualizarAsync(Servicio servicio);
        Task EliminarAsync(Guid id, Guid negocioId);
    }
}
