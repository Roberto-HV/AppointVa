using AppointVaAPI.Constants;
using AppointVaAPI.Data;
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
                .Include(c => c.Cliente)
                .Include(c => c.Servicio)
                .Include(c => c.Empleado)
                .Include(c => c.Negocio)
                .FirstOrDefaultAsync(c => c.Id == citaId);

            if (cita is null) return;
            if (cita.Estado == EstadosCitas.Cancelada || cita.Estado == EstadosCitas.Completada) return;

            var backendUrl = _config["BackendUrl"] ?? string.Empty;
            var icalUrl = string.IsNullOrWhiteSpace(backendUrl)
                ? null
                : $"{backendUrl}/api/publico/citas/{cita.CodigoConfirmacion}/ical";
            var googleCalUrl = GenerarGoogleCalendarUrl(cita);

            var emailCliente = cita.Cliente?.Email;
            await _notificacion.EnviarRecordatorioCitaAsync(
                cita, emailCliente ?? string.Empty, cita.Cliente?.NombreCompleto ?? string.Empty,
                icalUrl, googleCalUrl);

            var emailEmpleado = cita.Empleado?.Email;
            if (!string.IsNullOrWhiteSpace(emailEmpleado))
                await _notificacion.EnviarRecordatorioEmpleadoAsync(cita, emailEmpleado);
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
