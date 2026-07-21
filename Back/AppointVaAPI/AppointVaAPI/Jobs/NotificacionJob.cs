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
        private readonly IConfiguration _config;

        public NotificacionJob(ApplicationDbContext db, INotificacionService notificacion, IConfiguration config)
        {
            _db = db;
            _notificacion = notificacion;
            _config = config;
        }

        private Task<Cita?> CargarCitaAsync(Guid citaId) =>
            _db.Citas
                .Include(c => c.Cliente)
                .Include(c => c.Empleado)
                .Include(c => c.Servicio)
                .Include(c => c.Negocio)
                .FirstOrDefaultAsync(c => c.Id == citaId);

        public async Task EnviarConfirmacionAsync(Guid citaId, string emailDestino, string nombreCliente)
        {
            var cita = await CargarCitaAsync(citaId);
            if (cita is null) return;

            var frontendUrl = _config["FrontendUrl"] ?? "https://appointva.com";
            var backendUrl = _config["BackendUrl"] ?? string.Empty;
            var codigo = cita.CodigoConfirmacion;
            var urlCita = $"{frontendUrl}/b/{cita.Negocio?.Slug}/confirmacion/{codigo}";
            var urlCancelacion = $"{frontendUrl}/cancelar/{codigo}";
            var icalUrl = string.IsNullOrWhiteSpace(backendUrl) ? null
                : $"{backendUrl}/api/publico/citas/{codigo}/ical";
            var googleCalUrl = GenerarGoogleCalendarUrl(cita);

            await _notificacion.EnviarConfirmacionCitaAsync(cita, emailDestino, nombreCliente,
                urlCita, icalUrl, googleCalUrl, urlCancelacion);
        }

        public async Task EnviarCancelacionAsync(Guid citaId, string emailDestino, string nombreCliente)
        {
            var cita = await CargarCitaAsync(citaId);
            if (cita is null) return;
            await _notificacion.EnviarCancelacionCitaAsync(cita, emailDestino, nombreCliente);
        }

        private static string GenerarGoogleCalendarUrl(Cita cita)
        {
            var titulo = Uri.EscapeDataString(
                $"{cita.Servicio?.Nombre ?? "Cita"} - {cita.Negocio?.Nombre ?? "AppointVa"}");
            var inicio = cita.InicioEn.ToString("yyyyMMddTHHmmssZ");
            var fin = cita.FinEn.ToString("yyyyMMddTHHmmssZ");
            var detalles = Uri.EscapeDataString(
                $"Cita con {cita.Empleado?.Nombre ?? "el equipo"} en {cita.Negocio?.Nombre ?? "AppointVa"}");
            return $"https://calendar.google.com/calendar/render?action=TEMPLATE&text={titulo}&dates={inicio}/{fin}&details={detalles}";
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
