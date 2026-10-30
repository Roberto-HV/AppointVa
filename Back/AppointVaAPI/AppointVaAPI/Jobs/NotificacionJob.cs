using AppointVaAPI.Data;
using AppointVaAPI.Helpers;
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
        private readonly IEmailService _emailService;

        public NotificacionJob(ApplicationDbContext db, INotificacionService notificacion, IConfiguration config, IBackgroundJobClient jobClient, IEmailService emailService)
        {
            _db = db;
            _notificacion = notificacion;
            _config = config;
            _jobClient = jobClient;
            _emailService = emailService;
        }

        /// <summary>
        /// The appointment to message its client about, or null when there is nothing to
        /// send. Deliberately null when the client was deleted (soft delete) after the job
        /// was enqueued: a deleted client is not messaged by email or WhatsApp, even with
        /// the address captured at enqueue time. Before, an Include(c => c.Cliente) dropped
        /// the appointment by accident (INNER JOIN through the soft-delete filter); now the
        /// exclusion is explicit. Returning normally (no throw) means Hangfire does not retry.
        /// </summary>
        private async Task<Cita?> CargarCitaParaMensajeAlClienteAsync(Guid citaId)
        {
            var cita = await _db.Citas
                .Include(c => c.Empleado)
                .Include(c => c.Servicio)
                .Include(c => c.Negocio)
                .FirstOrDefaultAsync(c => c.Id == citaId);
            await ClientesDeCitasHelper.AdjuntarAsync(_db, cita);
            return cita?.Cliente is null ? null : cita;
        }

        public async Task EnviarConfirmacionAsync(Guid citaId, string emailDestino, string nombreCliente)
        {
            var cita = await CargarCitaParaMensajeAlClienteAsync(citaId);
            if (cita is null) return;

            var frontendUrl = _config["FrontendUrl"] ?? "https://appointva.com";
            var codigo = cita.CodigoConfirmacion;
            var urlCita = $"{frontendUrl}/b/{cita.Negocio?.Slug}/confirmacion/{codigo}";
            var urlCancelacion = $"{frontendUrl}/cancelar/{codigo}";
            var icalUrl = AppointVaAPI.Helpers.IcalHelper.UrlPublica(_config["BackendUrl"], codigo);
            var googleCalUrl = GenerarGoogleCalendarUrl(cita);

            await _notificacion.EnviarConfirmacionCitaAsync(cita, emailDestino, nombreCliente,
                urlCita, icalUrl, googleCalUrl, urlCancelacion);
        }

        public async Task EnviarCancelacionAsync(Guid citaId, string emailDestino, string nombreCliente)
        {
            var cita = await CargarCitaParaMensajeAlClienteAsync(citaId);
            if (cita is null) return;
            await _notificacion.EnviarCancelacionCitaAsync(cita, emailDestino, nombreCliente);
        }

        private static string GenerarGoogleCalendarUrl(Cita cita)
        {
            var titulo = Uri.EscapeDataString(
                $"{cita.Servicio?.Nombre ?? "Cita"} - {cita.Negocio?.Nombre ?? "AppointVa"}");
            var tz = ZonaHorariaHelper.Resolver(cita.Negocio?.ZonaHoraria);
            var inicioUtc = ZonaHorariaHelper.ToDateTimeOffset(cita.InicioEn, tz).UtcDateTime;
            var finUtc = ZonaHorariaHelper.ToDateTimeOffset(cita.FinEn, tz).UtcDateTime;
            var inicio = inicioUtc.ToString("yyyyMMddTHHmmssZ");
            var fin = finUtc.ToString("yyyyMMddTHHmmssZ");
            var detalles = Uri.EscapeDataString(
                $"Cita con {cita.Empleado?.Nombre ?? "el equipo"} en {cita.Negocio?.Nombre ?? "AppointVa"}");
            return $"https://calendar.google.com/calendar/render?action=TEMPLATE&text={titulo}&dates={inicio}/{fin}&details={detalles}";
        }

        public async Task EnviarReagendaAsync(Guid citaId, string emailDestino, string nombreCliente, DateTime fechaOriginal)
        {
            var cita = await CargarCitaParaMensajeAlClienteAsync(citaId);
            if (cita is null) return;
            await _notificacion.EnviarReagendarCitaAsync(cita, emailDestino, nombreCliente, fechaOriginal);
        }

        public async Task EnviarSolicitudResenaAsync(Guid citaId, string emailDestino, string nombreCliente, string urlResena)
        {
            var cita = await CargarCitaParaMensajeAlClienteAsync(citaId);
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

        public async Task EnviarTicketAsync(Guid citaId)
        {
            // Same rule as the other client messages: no ticket for a deleted client.
            var cita = await CargarCitaParaMensajeAlClienteAsync(citaId);

            if (cita is null || cita.Cliente is null || cita.Servicio is null || cita.Negocio is null) return;
            if (string.IsNullOrEmpty(cita.Cliente.Email)) return;

            await _emailService.EnviarTicketCitaAsync(
                destinoEmail:  cita.Cliente.Email,
                clienteNombre: cita.Cliente.NombreCompleto,
                negocioNombre: cita.Negocio.Nombre,
                servicio:      cita.Servicio.Nombre,
                fechaCita:     cita.InicioEn,
                montoCobrado:  cita.MontoCobrado ?? cita.Precio,
                metodoPago:    cita.MetodoPago ?? "No especificado",
                cambio:        cita.Cambio);
        }
    }
}
