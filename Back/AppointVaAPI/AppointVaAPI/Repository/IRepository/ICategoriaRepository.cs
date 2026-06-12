using AppointVaAPI.Models;

namespace AppointVaAPI.Repository.IRepository
{
    public interface ICategoriaRepository
    {
        Task<List<CategoriaServicio>> ObtenerTodosAsync(Guid negocioId);
        Task<CategoriaServicio?> ObtenerPorIdAsync(Guid id, Guid negocioId);
        Task<CategoriaServicio> CrearAsync(CategoriaServicio categoria);
        Task<CategoriaServicio> ActualizarAsync(CategoriaServicio categoria);
        Task EliminarAsync(Guid id, Guid negocioId);
    }
}
