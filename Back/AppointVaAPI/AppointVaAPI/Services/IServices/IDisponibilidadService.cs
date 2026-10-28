using AppointVaAPI.Models.Dtos.Publico;

namespace AppointVaAPI.Services.IServices
{
    public interface IDisponibilidadService
    {
        Task<List<SlotDisponibleDto>> ObtenerSlotsDisponiblesAsync(
            Guid negocioId, Guid servicioId, Guid? empleadoId, DateOnly fecha);

        /// <summary>
        /// Availability for <paramref name="dias"/> consecutive days starting at <paramref name="desde"/>.
        /// Always returns exactly one entry per day, in order.
        /// </summary>
        Task<List<DiaDisponibilidadDto>> ObtenerSlotsRangoAsync(
            Guid negocioId, Guid servicioId, Guid? empleadoId, DateOnly desde, int dias);
    }
}
