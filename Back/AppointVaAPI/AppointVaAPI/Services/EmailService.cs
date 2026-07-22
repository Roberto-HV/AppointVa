using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System.Text;
using System.Text.Json;

namespace AppointVaAPI.Services
{
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;
        private readonly ILogger<EmailService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly HttpClient _http;

        public EmailService(IConfiguration config, ILogger<EmailService> logger,
                            IServiceScopeFactory scopeFactory, IHttpClientFactory httpFactory)
        {
            _config = config;
            _logger = logger;
            _scopeFactory = scopeFactory;
            _http = httpFactory.CreateClient("Brevo");
        }

        public async Task EnviarConfirmacionCitaAsync(Cita cita, string emailDestino, string nombreCliente, string? urlCita = null, string? icalUrl = null, string? googleCalUrl = null, string? urlCancelacion = null)
        {
            if (!EstaHabilitado()) return;

            var esPendiente = cita.Estado == EstadosCitas.Pendiente;
            var asunto = esPendiente
                ? $"Solicitud de cita recibida — {cita.Servicio?.Nombre ?? "AppointVa"}"
                : $"¡Tu cita está confirmada! — {cita.Servicio?.Nombre ?? "AppointVa"}";
            var html = PlantillaConfirmacion(cita, nombreCliente, urlCita, icalUrl, googleCalUrl, urlCancelacion, esPendiente);
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

        public async Task EnviarReagendarCitaAsync(Cita cita, string emailDestino, string nombreCliente, DateTime fechaOriginal)
        {
            if (!EstaHabilitado()) return;
            var asunto = $"Tu cita ha sido reagendada — {cita.Servicio?.Nombre ?? "AppointVa"}";
            await EnviarAsync(emailDestino, asunto, PlantillaReagendar(cita, nombreCliente, fechaOriginal));
            if (cita.NegocioId != Guid.Empty) await RegistrarEmailAsync(cita.NegocioId, "Reagendar");
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

        public async Task EnviarNotificacionListaEsperaAsync(string emailDestino, string nombreCliente, string nombreNegocio, string nombreServicio, string urlReserva)
        {
            if (!EstaHabilitado()) return;
            var asunto = $"¡Hay un lugar disponible en {nombreNegocio}!";
            await EnviarAsync(emailDestino, asunto, PlantillaListaEspera(nombreCliente, nombreNegocio, nombreServicio, urlReserva));
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
                var apiKey = _config["Email:ApiKey"];
                if (string.IsNullOrWhiteSpace(apiKey))
                {
                    _logger.LogWarning("Email:ApiKey no configurada — email omitido.");
                    return;
                }

                var origen = _config["Email:Origen"] ?? "AppointVa <notificaciones@appointva.com>";
                // Parsear "Nombre <email>" → separar nombre y dirección
                string senderName = "AppointVa", senderEmail = origen;
                var lt = origen.IndexOf('<');
                if (lt >= 0 && origen.EndsWith('>'))
                {
                    senderName  = origen[..lt].Trim();
                    senderEmail = origen[(lt + 1)..^1].Trim();
                }

                var body = new
                {
                    sender  = new { name = senderName, email = senderEmail },
                    to      = new[] { new { email = destino } },
                    subject = asunto,
                    htmlContent = html
                };

                using var req = new HttpRequestMessage(HttpMethod.Post,
                    "https://api.brevo.com/v3/smtp/email");
                req.Headers.Add("api-key", apiKey);
                req.Content = new StringContent(
                    JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

                var response = await _http.SendAsync(req);
                if (!response.IsSuccessStatusCode)
                {
                    var err = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Brevo API {Status} al enviar a {Destino}: {Error}",
                        (int)response.StatusCode, MascarEmail(destino), err);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error al enviar email a {Destino}: {Mensaje}",
                    MascarEmail(destino), ex.Message);
            }
        }

        private static string MascarEmail(string email)
        {
            var i = email.IndexOf('@');
            if (i <= 1) return "***";
            return $"{email[0]}***{email[i..]}";
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

        private static string PlantillaConfirmacion(Cita cita, string nombreCliente, string? urlCita = null, string? icalUrl = null, string? googleCalUrl = null, string? urlCancelacion = null, bool esPendiente = false)
        {
            nombreCliente = nombreCliente.Trim();
            var negocio = cita.Negocio?.Nombre ?? "el negocio";
            var servicio = cita.Servicio?.Nombre ?? "el servicio";
            var empleado = cita.Empleado?.Nombre ?? string.Empty;
            var inicio = cita.InicioEn.ToString("dddd dd 'de' MMMM 'de' yyyy", new System.Globalization.CultureInfo("es-MX"));
            var hora = cita.InicioEn.ToString("HH:mm");
            var precio = cita.Precio.ToString("C", new System.Globalization.CultureInfo("es-MX"));
            var tituloHeader = esPendiente ? "Solicitud recibida" : "¡Cita confirmada!";
            var textoIntro = esPendiente
                ? $"Tu solicitud de cita en <strong>{negocio}</strong> fue recibida y está <strong>pendiente de confirmación</strong>. Te avisaremos en cuanto el negocio la confirme."
                : $"Tu cita en <strong>{negocio}</strong> ha sido agendada exitosamente.";

            return $"""
                <!DOCTYPE html>
                <html lang="es">
                <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
                  <div style="background:#1e293b;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
                    <h1 style="color:#fff;margin:0;font-size:22px;">{tituloHeader}</h1>
                  </div>
                  <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
                    <p>Hola <strong>{nombreCliente}</strong>,</p>
                    <p>{textoIntro}</p>
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
                    {(!esPendiente && (icalUrl is not null || googleCalUrl is not null) ? $"""
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

        private static string PlantillaListaEspera(string nombreCliente, string nombreNegocio, string nombreServicio, string urlReserva)
        {
            nombreCliente = nombreCliente.Trim();
            return $"""
                <!DOCTYPE html>
                <html lang="es">
                <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
                  <div style="background:#166534;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
                    <h1 style="color:#fff;margin:0;font-size:22px;">¡Hay un lugar disponible!</h1>
                  </div>
                  <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;">
                    <p>Hola <strong>{nombreCliente}</strong>,</p>
                    <p>Tenemos buenas noticias: quedó disponible un lugar en <strong>{nombreNegocio}</strong> para el servicio de <strong>{nombreServicio}</strong>.</p>
                    <p>Tienes <strong>2 horas</strong> para reservar tu lugar antes de que se ofrezca al siguiente en la lista.</p>
                    <div style="text-align:center;margin:28px 0;">
                      <a href="{urlReserva}" style="background:#C8A961;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;">
                        Reservar ahora
                      </a>
                    </div>
                    <p style="font-size:13px;color:#6b7280;">Si ya no necesitas el lugar, puedes ignorar este mensaje.</p>
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
