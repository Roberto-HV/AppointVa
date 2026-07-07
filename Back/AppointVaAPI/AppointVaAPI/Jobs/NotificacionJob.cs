using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Jobs
{
    /// <summary>
    /// Wrapper para jobs de notificación en Hangfire.
    /// Acepta solo tipos primitivos serializables (Guid, string, DateTime)
    /// y carga la entidad Cita fresca desde BD en un scope propio de DI.
    /// </summary>
    public class NotificacionJob
    {
        private readonly ApplicationDbContext _db;
        private readonly INotificacionService _notificacion;

        public NotificacionJob(ApplicationDbContext db, INotificacionService notificacion)
        {
            _db = db;
            _notificacion = notificacion;
        }

        private Task<Cita?> CargarCitaAsync(Guid citaId) =>
            _db.Citas
                .Include(c => c.Cliente)
                .Include(c => c.Empleado)
                .Include(c => c.Servicio)
                .Include(c => c.Negocio)
                .FirstOrDefaultAsync(c => c.Id == citaId);

        public async Task EnviarCancelacionAsync(Guid citaId, string emailDestino, string nombreCliente)
        {
            var cita = await CargarCitaAsync(citaId);
            if (cita is null) return;
            await _notificacion.EnviarCancelacionCitaAsync(cita, emailDestino, nombreCliente);
        }

        public async Task EnviarReagendaAsync(Guid citaId, string emailDestino, string nombreCliente, DateTime fechaOriginal)
        {
            var cita = await CargarCitaAsync(citaId);
            if (cita is null) return;
            await _notificacion.EnviarReagendarCitaAsync(cita, emailDestino, nombreCliente, fechaOriginal);
        }

        public async Task EnviarSolicitudResenaAsync(Guid citaId, string emailDestino, string nombreCliente, string urlResena)
        {
            var cita = await CargarCitaAsync(citaId);
            if (cita is null) return;
            await _notificacion.EnviarSolicitudResenaAsync(cita, emailDestino, nombreCliente, urlResena);
        }
    }
}
