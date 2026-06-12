using AppointVaAPI.Models;

namespace AppointVaAPI.Repository.IRepository
{
    public interface ICitaRepository
    {
        Task<List<Cita>> ObtenerCitasAsync(Guid negocioId, DateTime? desde, DateTime? hasta, Guid? empleadoId);
        Task<Cita?> ObtenerPorIdAsync(Guid id, Guid negocioId);
        Task<Cita?> ObtenerPorCodigoAsync(string codigo);
        Task<Cita> CrearAsync(Cita cita);
        Task ActualizarAsync(Cita cita);
        Task<bool> ExisteSolapamientoAsync(Guid empleadoId, DateTime inicio, DateTime fin, Guid? excluirCitaId = null);
        Task<List<Cita>> ObtenerCitasEmpleadoEnFechaAsync(Guid empleadoId, DateTime inicioDia, DateTime finDia);
    }
}
