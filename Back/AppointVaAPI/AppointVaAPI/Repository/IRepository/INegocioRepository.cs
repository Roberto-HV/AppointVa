using AppointVaAPI.Models;

namespace AppointVaAPI.Repository.IRepository
{
    public interface INegocioRepository
    {
        Task<Negocio?> ObtenerPorIdAsync(Guid id);
        Task<Negocio?> ObtenerPorSlugAsync(string slug);
        Task<List<Negocio>> ObtenerTodosAsync();
        Task<Negocio> CrearAsync(Negocio negocio);
        Task<Negocio> ActualizarAsync(Negocio negocio);
        Task EliminarAsync(Negocio negocio);
        Task<bool> SlugExisteAsync(string slug, Guid? excluirId = null);
    }
}
