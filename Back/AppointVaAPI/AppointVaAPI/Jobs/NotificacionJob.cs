using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;
using Hangfire;
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
        private readonly IBackgroundJobClient _jobClient;

        public NotificacionJob(ApplicationDbContext db, INotificacionService notificacion, IConfiguration config, IBackgroundJobClient jobClient)
        {
            _db = db;
            _notificacion = notificacion;
            _config = config;
            _jobClient = jobClient;
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

        public async Task NotificarListaEsperaAsync(Guid negocioId, Guid servicioId)
        {
            var entrada = await _db.ListaEspera
                .Include(le => le.Negocio)
                .Include(le => le.Servicio)
                .Where(le => le.NegocioId == negocioId && le.ServicioId == servicioId && le.Estado == "Esperando")
                .OrderBy(le => le.FechaCreacion)
                .FirstOrDefaultAsync();

            if (entrada is null) return;
            if (string.IsNullOrWhiteSpace(entrada.EmailCliente)) return;

            var frontendUrl = _config["FrontendUrl"] ?? "https://appointva.com";
            var urlReserva = $"{frontendUrl}/b/{entrada.Negocio?.Slug}";

            await _notificacion.EnviarNotificacionListaEsperaAsync(
                entrada.EmailCliente,
                entrada.NombreCliente,
                entrada.Negocio?.Nombre ?? string.Empty,
                entrada.Servicio?.Nombre ?? string.Empty,
                urlReserva);

            entrada.Estado = "Notificado";
            entrada.FechaNotificacion = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            _jobClient.Schedule<NotificacionJob>(
                j => j.ExpirarYNotificarSiguienteAsync(entrada.Id, negocioId, servicioId),
                TimeSpan.FromHours(2));
        }

        public async Task ExpirarYNotificarSiguienteAsync(Guid listaEsperaId, Guid negocioId, Guid servicioId)
        {
            var entrada = await _db.ListaEspera.FindAsync(listaEsperaId);
            if (entrada is null || entrada.Estado != "Notificado") return;

            entrada.Estado = "Expirado";
            await _db.SaveChangesAsync();

            _jobClient.Enqueue<NotificacionJob>(j => j.NotificarListaEsperaAsync(negocioId, servicioId));
        }
    }
}
