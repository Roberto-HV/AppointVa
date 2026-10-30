using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Helpers;
using AppointVaAPI.Services.IServices;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Services
{
    public class RecordatorioService : IRecordatorioService
    {
        private readonly ApplicationDbContext _db;
        private readonly INotificacionService _notificacion;
        private readonly IConfiguration _config;

        public RecordatorioService(ApplicationDbContext db, INotificacionService notificacion, IConfiguration config)
        {
            _db = db;
            _notificacion = notificacion;
            _config = config;
        }

        public async Task EnviarRecordatorioCitaAsync(Guid citaId)
        {
            var cita = await _db.Citas
                .Include(c => c.Servicio)
                .Include(c => c.Empleado)
                .Include(c => c.Negocio)
                .FirstOrDefaultAsync(c => c.Id == citaId);
            await ClientesDeCitasHelper.AdjuntarAsync(_db, cita);

            if (cita is null) return;
            if (cita.Estado == EstadosCitas.Cancelada || cita.Estado == EstadosCitas.Completada || cita.Estado == EstadosCitas.Inasistencia) return;
            // Deliberate: a client deleted after booking gets no reminder (no contact data
            // to use). Before, an Include(c => c.Cliente) hid the appointment by accident;
            // returning normally keeps Hangfire from retrying the job.
            if (cita.Cliente is null) return;

            var icalUrl = AppointVaAPI.Helpers.IcalHelper.UrlPublica(_config["BackendUrl"], cita.CodigoConfirmacion);
            var googleCalUrl = GenerarGoogleCalendarUrl(cita);

            var emailCliente = cita.Cliente?.Email;
            await _notificacion.EnviarRecordatorioCitaAsync(
                cita, emailCliente ?? string.Empty, cita.Cliente?.NombreCompleto ?? string.Empty,
                icalUrl, googleCalUrl);

        }

        private static string GenerarGoogleCalendarUrl(Models.Cita cita)
        {
            var titulo = Uri.EscapeDataString(
                $"{cita.Servicio?.Nombre ?? "Cita"} - {cita.Negocio?.Nombre ?? "AppointVa"}");
            var inicio = cita.InicioEn.ToString("yyyyMMddTHHmmssZ");
            var fin = cita.FinEn.ToString("yyyyMMddTHHmmssZ");
            var detalles = Uri.EscapeDataString(
                $"Cita con {cita.Empleado?.Nombre ?? "el equipo"} en {cita.Negocio?.Nombre ?? "AppointVa"}");
            return $"https://calendar.google.com/calendar/render?action=TEMPLATE&text={titulo}&dates={inicio}/{fin}&details={detalles}";
        }
    }
}
