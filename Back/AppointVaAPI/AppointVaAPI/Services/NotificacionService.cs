using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;

namespace AppointVaAPI.Services
{
    public class NotificacionService : INotificacionService
    {
        private readonly IEmailService _email;
        private readonly IWhatsAppService _whatsApp;
        private readonly ILogger<NotificacionService> _logger;
        private readonly IConfiguration _config;

        private const string MetodoWhatsApp = "WhatsApp";
        private const string MetodoAmbos = "Ambos";

        public NotificacionService(
            IEmailService email,
            IWhatsAppService whatsApp,
            ILogger<NotificacionService> logger,
            IConfiguration config)
        {
            _email = email;
            _whatsApp = whatsApp;
            _logger = logger;
            _config = config;
        }

        // ── Helpers ────────────────────────────────────────────────────────────

        private static string MetodoNegocio(Cita cita) =>
            cita.Negocio?.MetodoNotificacion ?? "Correo";

        private static bool UsaWhatsApp(Cita cita)
        {
            var m = MetodoNegocio(cita);
            return m == MetodoWhatsApp || m == MetodoAmbos;
        }

        private static bool UsaEmail(Cita cita)
        {
            var m = MetodoNegocio(cita);
            return m != MetodoWhatsApp; // Correo o Ambos
        }

        private static string ContactoNegocio(Cita cita)
        {
            var tel = cita.Negocio?.TelefonoWhatsApp ?? cita.Negocio?.Telefono;
            if (!string.IsNullOrWhiteSpace(tel))
                return $"\n📞 Contáctanos: wa.me/{new string(tel.Where(char.IsDigit).ToArray())}";
            return string.Empty;
        }

        private static string FormatearFechaHora(DateTime fechaUtc, string zonaHoraria)
        {
            try
            {
                var tz = TimeZoneInfo.FindSystemTimeZoneById(zonaHoraria);
                var local = TimeZoneInfo.ConvertTimeFromUtc(fechaUtc, tz);
                return local.ToString("dddd dd 'de' MMMM 'a las' HH:mm",
                    new System.Globalization.CultureInfo("es-MX"));
            }
            catch
            {
                return fechaUtc.ToString("dd/MM/yyyy HH:mm") + " (UTC)";
            }
        }

        // ── Notificaciones al cliente (configurables) ──────────────────────────

        public async Task EnviarConfirmacionCitaAsync(Cita cita, string emailDestino,
            string nombreCliente, string? urlCita = null, string? icalUrl = null,
            string? googleCalUrl = null)
        {
            if (UsaEmail(cita) && !string.IsNullOrWhiteSpace(emailDestino))
                await _email.EnviarConfirmacionCitaAsync(
                    cita, emailDestino, nombreCliente, urlCita, icalUrl, googleCalUrl);

            if (UsaWhatsApp(cita) && _whatsApp.EstaHabilitado())
            {
                var tel = cita.Cliente?.Telefono;
                if (!string.IsNullOrWhiteSpace(tel))
                {
                    var fecha = FormatearFechaHora(
                        cita.InicioEn, cita.Negocio?.ZonaHoraria ?? "Central Standard Time (Mexico)");
                    var msg = $"¡Hola {nombreCliente}! 👋\n\n" +
                              $"Tu cita en *{cita.Negocio?.Nombre}* ha sido confirmada:\n" +
                              $"📅 {fecha}\n" +
                              $"✂️ {cita.Servicio?.Nombre}\n" +
                              $"👤 Con {cita.Empleado?.Nombre}" +
                              ContactoNegocio(cita);
                    await _whatsApp.EnviarMensajeAsync(tel, msg);
                }
            }
        }

        public async Task EnviarCancelacionCitaAsync(Cita cita, string emailDestino,
            string nombreCliente)
        {
            if (UsaEmail(cita) && !string.IsNullOrWhiteSpace(emailDestino))
                await _email.EnviarCancelacionCitaAsync(cita, emailDestino, nombreCliente);

            if (UsaWhatsApp(cita) && _whatsApp.EstaHabilitado())
            {
                var tel = cita.Cliente?.Telefono;
                if (!string.IsNullOrWhiteSpace(tel))
                {
                    var fecha = FormatearFechaHora(
                        cita.InicioEn, cita.Negocio?.ZonaHoraria ?? "Central Standard Time (Mexico)");
                    var msg = $"❌ *Cita cancelada*\n\n" +
                              $"Hola {nombreCliente}, tu cita en *{cita.Negocio?.Nombre}* " +
                              $"del {fecha} ha sido cancelada.\n\n" +
                              $"¿Deseas reagendar?" +
                              ContactoNegocio(cita);
                    await _whatsApp.EnviarMensajeAsync(tel, msg);
                }
            }
        }

        public async Task EnviarRecordatorioCitaAsync(Cita cita, string emailDestino,
            string nombreCliente, string? icalUrl = null, string? googleCalUrl = null)
        {
            if (UsaEmail(cita) && !string.IsNullOrWhiteSpace(emailDestino))
                await _email.EnviarRecordatorioCitaAsync(
                    cita, emailDestino, nombreCliente, icalUrl, googleCalUrl);

            if (UsaWhatsApp(cita) && _whatsApp.EstaHabilitado())
            {
                var tel = cita.Cliente?.Telefono;
                if (!string.IsNullOrWhiteSpace(tel))
                {
                    var fecha = FormatearFechaHora(
                        cita.InicioEn, cita.Negocio?.ZonaHoraria ?? "Central Standard Time (Mexico)");
                    var msg = $"⏰ *Recordatorio de cita*\n\n" +
                              $"Hola {nombreCliente}, te recordamos tu cita:\n" +
                              $"📅 {fecha}\n" +
                              $"✂️ {cita.Servicio?.Nombre} con {cita.Empleado?.Nombre}\n" +
                              $"📍 {cita.Negocio?.Nombre}" +
                              ContactoNegocio(cita);
                    await _whatsApp.EnviarMensajeAsync(tel, msg);
                }
            }
        }

        public async Task EnviarReagendarCitaAsync(Cita cita, string emailDestino,
            string nombreCliente, DateTime fechaOriginal)
        {
            if (UsaEmail(cita) && !string.IsNullOrWhiteSpace(emailDestino))
                await _email.EnviarReagendarCitaAsync(cita, emailDestino, nombreCliente, fechaOriginal);

            if (UsaWhatsApp(cita) && _whatsApp.EstaHabilitado())
            {
                var tel = cita.Cliente?.Telefono;
                if (!string.IsNullOrWhiteSpace(tel))
                {
                    var zonaHoraria = cita.Negocio?.ZonaHoraria ?? "Central Standard Time (Mexico)";
                    var fechaNueva = FormatearFechaHora(cita.InicioEn, zonaHoraria);
                    var msg = $"📅 *Cita reagendada*\n\n" +
                              $"Hola {nombreCliente}, tu cita en *{cita.Negocio?.Nombre}* " +
                              $"ha sido reagendada:\n\n" +
                              $"✅ Nueva fecha: {fechaNueva}\n" +
                              $"✂️ {cita.Servicio?.Nombre} con {cita.Empleado?.Nombre}" +
                              ContactoNegocio(cita);
                    await _whatsApp.EnviarMensajeAsync(tel, msg);
                }
            }
        }

        public async Task EnviarSolicitudResenaAsync(Cita cita, string emailDestino,
            string nombreCliente, string urlResena)
        {
            if (UsaEmail(cita) && !string.IsNullOrWhiteSpace(emailDestino))
                await _email.EnviarSolicitudResenaAsync(cita, emailDestino, nombreCliente, urlResena);

            if (UsaWhatsApp(cita) && _whatsApp.EstaHabilitado())
            {
                var tel = cita.Cliente?.Telefono;
                if (!string.IsNullOrWhiteSpace(tel))
                {
                    var msg = $"⭐ *¿Cómo fue tu experiencia?*\n\n" +
                              $"Hola {nombreCliente}, gracias por visitar *{cita.Negocio?.Nombre}*. " +
                              $"¿Nos dejas una reseña?\n\n" +
                              $"👉 {urlResena}";
                    await _whatsApp.EnviarMensajeAsync(tel, msg);
                }
            }
        }

        // ── Notificaciones al negocio/empleado (siempre por email) ─────────────

        public async Task EnviarRecordatorioEmpleadoAsync(Cita cita, string emailDestino)
        {
            if (!string.IsNullOrWhiteSpace(emailDestino))
                await _email.EnviarRecordatorioEmpleadoAsync(cita, emailDestino);
        }

        public async Task EnviarNuevaCitaPropietarioAsync(Cita cita, string emailDestino)
        {
            if (!string.IsNullOrWhiteSpace(emailDestino))
                await _email.EnviarNuevaCitaPropietarioAsync(cita, emailDestino);
        }

        public async Task EnviarCancelacionClienteAlPropietarioAsync(Cita cita, string emailDestino)
        {
            if (!string.IsNullOrWhiteSpace(emailDestino))
                await _email.EnviarCancelacionClienteAlPropietarioAsync(cita, emailDestino);
        }
    }
}
