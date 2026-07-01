using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Resend;

namespace AppointVaAPI.Services
{
    public class EmailService : IEmailService
    {
        private readonly IResend _resend;
        private readonly IConfiguration _config;
        private readonly ILogger<EmailService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;

        public EmailService(IResend resend, IConfiguration config, ILogger<EmailService> logger, IServiceScopeFactory scopeFactory)
        {
            _resend = resend;
            _config = config;
            _logger = logger;
            _scopeFactory = scopeFactory;
        }

        public async Task EnviarConfirmacionCitaAsync(Cita cita, string emailDestino, string nombreCliente, string? urlCita = null, string? icalUrl = null, string? googleCalUrl = null, string? urlCancelacion = null)
        {
            if (!EstaHabilitado()) return;

            var asunto = $"¡Tu cita está confirmada! — {cita.Servicio?.Nombre ?? "AppointVa"}";
            var html = PlantillaConfirmacion(cita, nombreCliente, urlCita, icalUrl, googleCalUrl, urlCancelacion);
            await EnviarAsync(emailDestino, asunto, html);
            if (cita.NegocioId != Guid.Empty) await RegistrarEmailAsync(cita.NegocioId, "Confirmacion");
        }

        public async Task EnviarCancelacionCitaAsync(Cita cita, string emailDestino, string nombreCliente)
        {
            if (!EstaHabilitado()) return;

            var asunto = $"Cita cancelada — {cita.Servicio?.Nombre ?? "AppointVa"}";
            var html = PlantillaCancelacion(cita, nombreCliente);
            await EnviarAsync(emailDestino, asunto, html);
            if (cita.NegocioId != Guid.Empty) await RegistrarEmailAsync(cita.NegocioId, "Cancelacion");
        }

        public async Task EnviarRecordatorioCitaAsync(Cita cita, string emailDestino, string nombreCliente, string? icalUrl = null, string? googleCalUrl = null)
        {
            if (!EstaHabilitado()) return;

            var asunto = $"Recordatorio: tu cita es mañana — {cita.Servicio?.Nombre ?? "AppointVa"}";
            var html = PlantillaRecordatorio(cita, nombreCliente, icalUrl, googleCalUrl);
            await EnviarAsync(emailDestino, asunto, html);
            if (cita.NegocioId != Guid.Empty) await RegistrarEmailAsync(cita.NegocioId, "Recordatorio");
        }

        public async Task EnviarNuevaCitaPropietarioAsync(Cita cita, string emailDestino)
        {
            if (!EstaHabilitado()) return;
            var asunto = $"Nueva cita agendada — {cita.Servicio?.Nombre ?? "AppointVa"}";
            await EnviarAsync(emailDestino, asunto, PlantillaNuevaCitaPropietario(cita));
            if (cita.NegocioId != Guid.Empty) await RegistrarEmailAsync(cita.NegocioId, "NuevaCitaPropietario");
        }

        public async Task EnviarCancelacionClienteAlPropietarioAsync(Cita cita, string emailDestino)
        {
            if (!EstaHabilitado()) return;
            var asunto = $"Cita cancelada por el cliente — {cita.Servicio?.Nombre ?? "AppointVa"}";
            await EnviarAsync(emailDestino, asunto, PlantillaCancelacionPropietario(cita));
            if (cita.NegocioId != Guid.Empty) await RegistrarEmailAsync(cita.NegocioId, "CancelacionPropietario");
        }

        public async Task EnviarReagendarCitaAsync(Cita cita, string emailDestino, string nombreCliente, DateTime fechaOriginal)
        {
            if (!EstaHabilitado()) return;
            var asunto = $"Tu cita ha sido reagendada — {cita.Servicio?.Nombre ?? "AppointVa"}";
            await EnviarAsync(emailDestino, asunto, PlantillaReagendar(cita, nombreCliente, fechaOriginal));
            if (cita.NegocioId != Guid.Empty) await RegistrarEmailAsync(cita.NegocioId, "Reagendar");
        }

        public async Task EnviarRecordatorioEmpleadoAsync(Cita cita, string emailDestino)
        {
            if (!EstaHabilitado()) return;
            var asunto = $"Recordatorio: tienes una cita — {cita.Negocio?.Nombre ?? "AppointVa"}";
            await EnviarAsync(emailDestino, asunto, PlantillaRecordatorioEmpleado(cita));
            if (cita.NegocioId != Guid.Empty) await RegistrarEmailAsync(cita.NegocioId, "RecordatorioEmpleado");
        }

        public async Task EnviarVerificacionEmailAsync(string emailDestino, string nombre, string urlVerificacion)
        {
            if (!EstaHabilitado()) return;
            const string asunto = "Verifica tu correo — AppointVa";
            await EnviarAsync(emailDestino, asunto, PlantillaVerificacion(nombre, urlVerificacion));
        }

        public async Task EnviarSolicitudResenaAsync(Cita cita, string emailDestino, string nombreCliente, string urlResena)
        {
            if (!EstaHabilitado()) return;
            var asunto = $"¿Cómo fue tu experiencia en {cita.Negocio?.Nombre ?? "el negocio"}?";
            await EnviarAsync(emailDestino, asunto, PlantillaSolicitudResena(cita, nombreCliente, urlResena));
            if (cita.NegocioId != Guid.Empty) await RegistrarEmailAsync(cita.NegocioId, "SolicitudResena");
        }

        public async Task EnviarRecuperacionContrasenaAsync(string emailDestino, string nombre, string urlReset)
        {
            if (!EstaHabilitado()) return;

            const string asunto = "Recupera tu contraseña — AppointVa";
            var html = PlantillaRecuperacion(nombre, urlReset);
            await EnviarAsync(emailDestino, asunto, html);
        }

        private async Task EnviarAsync(string destino, string asunto, string html)
        {
            try
            {
                var mensaje = new EmailMessage
                {
                    From = _config["Email:Origen"]!,
                    Subject = asunto,
                    HtmlBody = html
                };
                mensaje.To.Add(destino);

                await _resend.EmailSendAsync(mensaje);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error al enviar email a {Destino}: {Mensaje}", destino, ex.Message);
            }
        }

        private bool EstaHabilitado()
        {
            var habilitado = _config["Email:Habilitado"];
            return habilitado != null && bool.TryParse(habilitado, out var val) && val;
        }

        private async Task RegistrarEmailAsync(Guid negocioId, string tipo)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                db.EmailLogs.Add(new EmailLog
                {
                    Id = Guid.NewGuid(),
                    NegocioId = negocioId,
                    Tipo = tipo,
                    EnviadoEn = DateTime.UtcNow
                });
                await db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo registrar EmailLog para negocio {NegocioId}", negocioId);
            }
        }

        private static string PlantillaConfirmacion(Cita cita, string nombreCliente, string? urlCita = null, string? icalUrl = null, string? googleCalUrl = null, string? urlCancelacion = null)
        {
            nombreCliente = nombreCliente.Trim();
            var negocio = cita.Negocio?.Nombre ?? "el negocio";
            var servicio = cita.Servicio?.Nombre ?? "el servicio";
            var empleado = cita.Empleado?.Nombre ?? string.Empty;
            var inicio = cita.InicioEn.ToString("dddd dd 'de' MMMM 'de' yyyy", new System.Globalization.CultureInfo("es-MX"));
            var hora = cita.InicioEn.ToString("HH:mm");
            var precio = cita.Precio.ToString("C", new System.Globalization.CultureInfo("es-MX"));

            return $"""
                <!DOCTYPE html>
                <html lang="es">
                <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
                  <div style="background:#1e293b;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
                    <h1 style="color:#fff;margin:0;font-size:22px;">¡Cita confirmada!</h1>
                  </div>
                  <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
                    <p>Hola <strong>{nombreCliente}</strong>,</p>
                    <p>Tu cita en <strong>{negocio}</strong> ha sido agendada exitosamente.</p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                      <tr style="border-bottom:1px solid #e5e7eb;">
                        <td style="padding:10px 0;color:#6b7280;width:40%;">Servicio</td>
                        <td style="padding:10px 0;font-weight:600;">{servicio}</td>
                      </tr>
                      {(string.IsNullOrEmpty(empleado) ? "" : $"""
                      <tr style="border-bottom:1px solid #e5e7eb;">
                        <td style="padding:10px 0;color:#6b7280;">Atendido por</td>
                        <td style="padding:10px 0;font-weight:600;">{empleado}</td>
                      </tr>
                      """)}
                      <tr style="border-bottom:1px solid #e5e7eb;">
                        <td style="padding:10px 0;color:#6b7280;">Fecha</td>
                        <td style="padding:10px 0;font-weight:600;">{inicio}</td>
                      </tr>
                      <tr style="border-bottom:1px solid #e5e7eb;">
                        <td style="padding:10px 0;color:#6b7280;">Hora</td>
                        <td style="padding:10px 0;font-weight:600;">{hora}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;color:#6b7280;">Precio</td>
                        <td style="padding:10px 0;font-weight:600;">{precio}</td>
                      </tr>
                    </table>
                    <div style="background:#FBF7EC;border:1px solid #E8D4A0;border-radius:6px;padding:14px;margin:16px 0;text-align:center;">
                      <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Código de confirmación</p>
                      <p style="margin:0;font-size:24px;font-weight:700;color:#C8A961;letter-spacing:4px;">{cita.CodigoConfirmacion}</p>
                    </div>
                    {(string.IsNullOrEmpty(urlCita) ? "" : $"""
                    <div style="text-align:center;margin:20px 0;">
                      <a href="{urlCita}" style="background:#C8A961;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;display:inline-block;">
                        Ver mi cita
                      </a>
                    </div>
                    """)}
                    {((icalUrl is not null || googleCalUrl is not null) ? $"""
                    <div style="margin:20px 0;text-align:center;">
                      <p style="font-size:13px;color:#6b7280;margin-bottom:10px;">Agrega tu cita al calendario:</p>
                      {(icalUrl is not null ? $"""<a href="{icalUrl}" style="display:inline-block;background:#1f2937;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;margin:4px;">Guardar en calendario</a>""" : "")}
                      {(googleCalUrl is not null ? $"""<a href="{googleCalUrl}" style="display:inline-block;background:#EA4335;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;margin:4px;">Google Calendar</a>""" : "")}
                    </div>
                    """ : "")}
                    {(string.IsNullOrEmpty(urlCancelacion) ? "<p style=\"font-size:13px;color:#6b7280;\">Guarda este código — lo necesitarás si deseas cancelar tu cita.</p>" : $"""
                    <div style="text-align:center;margin:16px 0 8px;">
                      <a href="{urlCancelacion}" style="background:#f3f4f6;color:#6b7280;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600;border:1px solid #e5e7eb;display:inline-block;">
                        Cancelar mi cita
                      </a>
                    </div>
                    """)}
                  </div>
                </body>
                </html>
                """;
        }

        private static string PlantillaCancelacion(Cita cita, string nombreCliente)
        {
            nombreCliente = nombreCliente.Trim();
            var negocio = cita.Negocio?.Nombre ?? "el negocio";
            var servicio = cita.Servicio?.Nombre ?? "el servicio";
            var inicio = cita.InicioEn.ToString("dddd dd 'de' MMMM 'de' yyyy HH:mm", new System.Globalization.CultureInfo("es-MX"));

            return $"""
                <!DOCTYPE html>
                <html lang="es">
                <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
                  <div style="background:#DC2626;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
                    <h1 style="color:#fff;margin:0;font-size:22px;">Cita cancelada</h1>
                  </div>
                  <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
                    <p>Hola <strong>{nombreCliente}</strong>,</p>
                    <p>Tu cita de <strong>{servicio}</strong> en <strong>{negocio}</strong> el <strong>{inicio}</strong> ha sido cancelada.</p>
                    {(string.IsNullOrEmpty(cita.MotivoCancelacion) ? "" : $"<p>Motivo: {cita.MotivoCancelacion}</p>")}
                    <p>Si deseas reagendar, visita nuevamente el sitio del negocio.</p>
                  </div>
                </body>
                </html>
                """;
        }

        private static string PlantillaRecuperacion(string nombre, string urlReset)
        {
            return $"""
                <!DOCTYPE html>
                <html lang="es">
                <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
                  <div style="background:#1f2937;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
                    <h1 style="color:#fff;margin:0;font-size:22px;">Recupera tu contraseña</h1>
                  </div>
                  <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
                    <p>Hola <strong>{nombre}</strong>,</p>
                    <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en AppointVa.</p>
                    <p>Haz clic en el siguiente botón para crear una nueva contraseña. Este enlace es válido por <strong>1 hora</strong>.</p>
                    <div style="text-align:center;margin:28px 0;">
                      <a href="{urlReset}"
                        style="background:#C8A961;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;">
                        Restablecer contraseña
                      </a>
                    </div>
                    <p style="font-size:13px;color:#6b7280;">Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña actual seguirá siendo la misma.</p>
                    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
                    <p style="font-size:12px;color:#9ca3af;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br/><a href="{urlReset}" style="color:#C8A961;">{urlReset}</a></p>
                  </div>
                </body>
                </html>
                """;
        }

        private static string PlantillaNuevaCitaPropietario(Cita cita)
        {
            var cliente = cita.Cliente?.NombreCompleto ?? "Cliente";
            var servicio = cita.Servicio?.Nombre ?? "Servicio";
            var empleado = cita.Empleado?.Nombre ?? string.Empty;
            var inicio = cita.InicioEn.ToString("dddd dd 'de' MMMM 'de' yyyy", new System.Globalization.CultureInfo("es-MX"));
            var hora = cita.InicioEn.ToString("HH:mm");
            var telefono = cita.Cliente?.Telefono ?? "—";
            var email = cita.Cliente?.Email ?? "—";

            return $"""
                <!DOCTYPE html>
                <html lang="es">
                <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
                  <div style="background:#1e293b;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
                    <h1 style="color:#fff;margin:0;font-size:22px;">Nueva cita agendada</h1>
                  </div>
                  <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
                    <p>Se ha agendado una nueva cita en tu negocio:</p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                      <tr style="border-bottom:1px solid #e5e7eb;">
                        <td style="padding:10px 0;color:#6b7280;width:40%;">Cliente</td>
                        <td style="padding:10px 0;font-weight:600;">{cliente}</td>
                      </tr>
                      <tr style="border-bottom:1px solid #e5e7eb;">
                        <td style="padding:10px 0;color:#6b7280;">Teléfono</td>
                        <td style="padding:10px 0;font-weight:600;">{telefono}</td>
                      </tr>
                      <tr style="border-bottom:1px solid #e5e7eb;">
                        <td style="padding:10px 0;color:#6b7280;">Correo</td>
                        <td style="padding:10px 0;font-weight:600;">{email}</td>
                      </tr>
                      <tr style="border-bottom:1px solid #e5e7eb;">
                        <td style="padding:10px 0;color:#6b7280;">Servicio</td>
                        <td style="padding:10px 0;font-weight:600;">{servicio}</td>
                      </tr>
                      {(string.IsNullOrEmpty(empleado) ? "" : $"""
                      <tr style="border-bottom:1px solid #e5e7eb;">
                        <td style="padding:10px 0;color:#6b7280;">Empleado</td>
                        <td style="padding:10px 0;font-weight:600;">{empleado}</td>
                      </tr>
                      """)}
                      <tr style="border-bottom:1px solid #e5e7eb;">
                        <td style="padding:10px 0;color:#6b7280;">Fecha</td>
                        <td style="padding:10px 0;font-weight:600;">{inicio}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;color:#6b7280;">Hora</td>
                        <td style="padding:10px 0;font-weight:600;">{hora}</td>
                      </tr>
                    </table>
                    <p style="font-size:13px;color:#6b7280;">Código de confirmación: <strong>{cita.CodigoConfirmacion}</strong></p>
                  </div>
                </body>
                </html>
                """;
        }

        private static string PlantillaCancelacionPropietario(Cita cita)
        {
            var cliente = cita.Cliente?.NombreCompleto ?? "Cliente";
            var servicio = cita.Servicio?.Nombre ?? "Servicio";
            var inicio = cita.InicioEn.ToString("dddd dd 'de' MMMM 'de' yyyy HH:mm", new System.Globalization.CultureInfo("es-MX"));

            return $"""
                <!DOCTYPE html>
                <html lang="es">
                <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
                  <div style="background:#DC2626;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
                    <h1 style="color:#fff;margin:0;font-size:22px;">Cita cancelada por el cliente</h1>
                  </div>
                  <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
                    <p>El cliente <strong>{cliente}</strong> ha cancelado su cita:</p>
                    <p><strong>{servicio}</strong> — {inicio}</p>
                    <p>Teléfono: <strong>{cita.Cliente?.Telefono ?? "—"}</strong></p>
                    <p style="font-size:13px;color:#6b7280;">El horario ha quedado liberado.</p>
                  </div>
                </body>
                </html>
                """;
        }

        private static string PlantillaReagendar(Cita cita, string nombreCliente, DateTime fechaOriginal)
        {
            nombreCliente = nombreCliente.Trim();
            var servicio = cita.Servicio?.Nombre ?? "el servicio";
            var negocio = cita.Negocio?.Nombre ?? "el negocio";
            var empleado = cita.Empleado?.Nombre ?? string.Empty;
            var nuevaFecha = cita.InicioEn.ToString("dddd dd 'de' MMMM 'de' yyyy", new System.Globalization.CultureInfo("es-MX"));
            var nuevaHora = cita.InicioEn.ToString("HH:mm");
            var fechaOriginalStr = fechaOriginal.ToString("dddd dd 'de' MMMM 'de' yyyy HH:mm", new System.Globalization.CultureInfo("es-MX"));

            return $"""
                <!DOCTYPE html>
                <html lang="es">
                <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
                  <div style="background:#0369a1;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
                    <h1 style="color:#fff;margin:0;font-size:22px;">Cita reagendada</h1>
                  </div>
                  <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
                    <p>Hola <strong>{nombreCliente}</strong>,</p>
                    <p>Tu cita de <strong>{servicio}</strong> en <strong>{negocio}</strong> ha sido reagendada.</p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                      <tr style="border-bottom:1px solid #e5e7eb;">
                        <td style="padding:10px 0;color:#6b7280;width:40%;">Fecha anterior</td>
                        <td style="padding:10px 0;text-decoration:line-through;color:#9ca3af;">{fechaOriginalStr}</td>
                      </tr>
                      <tr style="border-bottom:1px solid #e5e7eb;">
                        <td style="padding:10px 0;color:#6b7280;">Nueva fecha</td>
                        <td style="padding:10px 0;font-weight:600;">{nuevaFecha}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;color:#6b7280;">Nueva hora</td>
                        <td style="padding:10px 0;font-weight:600;">{nuevaHora}{(string.IsNullOrEmpty(empleado) ? "" : $" con {empleado}")}</td>
                      </tr>
                    </table>
                    <p style="font-size:13px;color:#6b7280;">Tu código de confirmación sigue siendo: <strong>{cita.CodigoConfirmacion}</strong></p>
                  </div>
                </body>
                </html>
                """;
        }

        private static string PlantillaRecordatorioEmpleado(Cita cita)
        {
            var cliente = cita.Cliente?.NombreCompleto ?? "Cliente";
            var servicio = cita.Servicio?.Nombre ?? "Servicio";
            var hora = cita.InicioEn.ToString("HH:mm");
            var fecha = cita.InicioEn.ToString("dddd dd 'de' MMMM 'de' yyyy", new System.Globalization.CultureInfo("es-MX"));
            var telefono = cita.Cliente?.Telefono ?? "—";

            return $"""
                <!DOCTYPE html>
                <html lang="es">
                <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
                  <div style="background:#b45309;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
                    <h1 style="color:#fff;margin:0;font-size:22px;">Tienes una cita mañana</h1>
                  </div>
                  <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
                    <p>Este es un recordatorio de tu próxima cita:</p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                      <tr style="border-bottom:1px solid #e5e7eb;">
                        <td style="padding:10px 0;color:#6b7280;width:40%;">Cliente</td>
                        <td style="padding:10px 0;font-weight:600;">{cliente}</td>
                      </tr>
                      <tr style="border-bottom:1px solid #e5e7eb;">
                        <td style="padding:10px 0;color:#6b7280;">Teléfono</td>
                        <td style="padding:10px 0;font-weight:600;">{telefono}</td>
                      </tr>
                      <tr style="border-bottom:1px solid #e5e7eb;">
                        <td style="padding:10px 0;color:#6b7280;">Servicio</td>
                        <td style="padding:10px 0;font-weight:600;">{servicio}</td>
                      </tr>
                      <tr style="border-bottom:1px solid #e5e7eb;">
                        <td style="padding:10px 0;color:#6b7280;">Fecha</td>
                        <td style="padding:10px 0;font-weight:600;">{fecha}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;color:#6b7280;">Hora</td>
                        <td style="padding:10px 0;font-weight:600;">{hora}</td>
                      </tr>
                    </table>
                    <p style="font-size:13px;color:#6b7280;">Código de confirmación del cliente: <strong>{cita.CodigoConfirmacion}</strong></p>
                  </div>
                </body>
                </html>
                """;
        }

        private static string PlantillaVerificacion(string nombre, string urlVerificacion)
        {
            return $"""
                <!DOCTYPE html>
                <html lang="es">
                <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
                  <div style="background:#1e293b;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
                    <h1 style="color:#fff;margin:0;font-size:22px;">Verifica tu correo electrónico</h1>
                  </div>
                  <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
                    <p>Hola <strong>{nombre}</strong>,</p>
                    <p>Gracias por registrar tu negocio en AppointVa. Para activar tu cuenta, haz clic en el siguiente botón:</p>
                    <div style="text-align:center;margin:28px 0;">
                      <a href="{urlVerificacion}"
                        style="background:#C8A961;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;">
                        Verificar mi correo
                      </a>
                    </div>
                    <p style="font-size:13px;color:#6b7280;">Este enlace es válido por <strong>24 horas</strong>. Si no creaste esta cuenta, puedes ignorar este correo.</p>
                    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
                    <p style="font-size:12px;color:#9ca3af;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br/><a href="{urlVerificacion}" style="color:#C8A961;">{urlVerificacion}</a></p>
                  </div>
                </body>
                </html>
                """;
        }

        private static string PlantillaRecordatorio(Cita cita, string nombreCliente, string? icalUrl = null, string? googleCalUrl = null)
        {
            nombreCliente = nombreCliente.Trim();
            var negocio = cita.Negocio?.Nombre ?? "el negocio";
            var servicio = cita.Servicio?.Nombre ?? "el servicio";
            var hora = cita.InicioEn.ToString("HH:mm");
            var empleado = cita.Empleado?.Nombre ?? string.Empty;

            return $"""
                <!DOCTYPE html>
                <html lang="es">
                <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
                  <div style="background:#b45309;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
                    <h1 style="color:#fff;margin:0;font-size:22px;">Recordatorio de cita</h1>
                  </div>
                  <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
                    <p>Hola <strong>{nombreCliente}</strong>,</p>
                    <p>Te recordamos que mañana tienes una cita en <strong>{negocio}</strong>.</p>
                    <p><strong>{servicio}</strong> a las <strong>{hora}</strong>{(string.IsNullOrEmpty(empleado) ? "" : $" con {empleado}")}.</p>
                    {((icalUrl is not null || googleCalUrl is not null) ? $"""
                    <div style="margin:20px 0;text-align:center;">
                      <p style="font-size:13px;color:#6b7280;margin-bottom:10px;">Agrega tu cita al calendario:</p>
                      {(icalUrl is not null ? $"""<a href="{icalUrl}" style="display:inline-block;background:#1f2937;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;margin:4px;">Guardar en calendario</a>""" : "")}
                      {(googleCalUrl is not null ? $"""<a href="{googleCalUrl}" style="display:inline-block;background:#EA4335;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;margin:4px;">Google Calendar</a>""" : "")}
                    </div>
                    """ : "")}
                    <p style="font-size:13px;color:#6b7280;">Si no puedes asistir, cancela con anticipación usando tu código: <strong>{cita.CodigoConfirmacion}</strong></p>
                  </div>
                </body>
                </html>
                """;
        }

        private static string PlantillaSolicitudResena(Cita cita, string nombreCliente, string urlResena)
        {
            var negocio = cita.Negocio?.Nombre ?? "el negocio";
            var servicio = cita.Servicio?.Nombre ?? "el servicio";
            return $"""
                <!DOCTYPE html>
                <html lang="es">
                <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
                  <div style="background:#1a1a1a;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
                    <h1 style="color:#C8A961;margin:0;font-size:22px;">¿Cómo fue tu experiencia?</h1>
                  </div>
                  <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
                    <p>Hola <strong>{nombreCliente}</strong>,</p>
                    <p>Gracias por visitar <strong>{negocio}</strong>. Esperamos que tu servicio de <strong>{servicio}</strong> haya sido excelente.</p>
                    <p>Tu opinión nos ayuda a mejorar. ¿Nos dejas una reseña? Solo te tomará un minuto.</p>
                    <div style="text-align:center;margin:28px 0;">
                      <a href="{urlResena}" style="display:inline-block;background:#C8A961;color:#1a1a1a;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:700;">⭐ Dejar mi reseña</a>
                    </div>
                    <p style="font-size:12px;color:#9ca3af;text-align:center;">Este enlace es válido por 7 días. Si ya dejaste tu reseña, ignora este mensaje.</p>
                  </div>
                </body>
                </html>
                """;
        }
    }
}
