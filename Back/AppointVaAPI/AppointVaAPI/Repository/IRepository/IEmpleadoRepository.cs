using AppointVaAPI.Models;

namespace AppointVaAPI.Repository.IRepository
{
    public interface IEmpleadoRepository
    {
        Task<List<Empleado>> ObtenerTodosAsync(Guid negocioId, bool incluirInactivos = false);
        Task<Empleado?> ObtenerPorIdAsync(Guid id, Guid negocioId);
        Task<Empleado> CrearAsync(Empleado empleado);
        Task<Empleado> ActualizarAsync(Empleado empleado);
        Task EliminarAsync(Guid id, Guid negocioId);

        Task<List<Guid>> ObtenerServicioIdsAsync(Guid empleadoId);
        Task<Dictionary<Guid, List<Guid>>> ObtenerServicioIdsBatchAsync(IEnumerable<Guid> empleadoIds);
        Task ActualizarServiciosAsync(Guid empleadoId, List<Guid> servicioIds);

        Task<List<HorarioEmpleado>> ObtenerHorariosAsync(Guid empleadoId, Guid negocioId);
        Task ActualizarHorariosAsync(Guid empleadoId, Guid negocioId, List<HorarioEmpleado> horarios);

        Task<List<BloqueoHorario>> ObtenerBloqueosAsync(Guid empleadoId, Guid negocioId);
        Task<BloqueoHorario> CrearBloqueoAsync(BloqueoHorario bloqueo);
        Task EliminarBloqueoAsync(Guid bloqueoId, Guid negocioId);
    }
}
