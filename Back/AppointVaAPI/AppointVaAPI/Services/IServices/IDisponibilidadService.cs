using AppointVaAPI.Models.Dtos.Publico;

namespace AppointVaAPI.Services.IServices
{
    public interface IDisponibilidadService
    {
        Task<List<SlotDisponibleDto>> ObtenerSlotsDisponiblesAsync(
            Guid negocioId, Guid servicioId, Guid? empleadoId, DateOnly fecha);
    }
}
