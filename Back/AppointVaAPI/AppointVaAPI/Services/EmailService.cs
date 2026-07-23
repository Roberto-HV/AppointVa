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

        public async Task EnviarBienvenidaAsync(string emailDestino, string nombre, string negocioNombre, string slug, string urlDashboard)
        {
            if (!EstaHabilitado()) return;

            var frontendUrl = _config["FrontendUrl"] ?? "https://appointva.com";
            var urlReservas = $"{frontendUrl}/b/{slug}";
            var asunto = $"¡Bienvenido a AppointVa, {nombre}!";
            await EnviarAsync(emailDestino, asunto, PlantillaBienvenida(nombre, negocioNombre, urlReservas, urlDashboard));
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
            var negocio  = cita.Negocio?.Nombre ?? "el negocio";
            var servicio = cita.Servicio?.Nombre ?? "el servicio";
            var empleado = cita.Empleado?.Nombre ?? string.Empty;
            var inicio   = cita.InicioEn.ToString("dddd dd 'de' MMMM 'de' yyyy", new System.Globalization.CultureInfo("es-MX"));
            var hora     = $"{cita.InicioEn:HH:mm} – {cita.FinEn:HH:mm} h";
            var precio   = cita.Precio.ToString("C", new System.Globalization.CultureInfo("es-MX"));
            var stripeColor  = esPendiente ? "#f59e0b" : "#10b981";
            var iconEmoji    = esPendiente ? "⏳" : "✅";
            var iconBg       = esPendiente ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)";
            var tituloHeader = esPendiente ? "Solicitud de cita recibida" : "¡Tu cita está confirmada!";
            var textoIntro   = esPendiente
                ? $"Tu solicitud de cita en <strong>{negocio}</strong> fue recibida y está <strong>pendiente de confirmación</strong>. Te avisaremos en cuanto sea confirmada."
                : $"Tu reserva en <strong>{negocio}</strong> ha sido confirmada. Te esperamos.";

            var filaEmpleado = string.IsNullOrEmpty(empleado) ? "" : $"""
                      <tr>
                        <td style="padding:10px 12px;background:#f8fafc;color:#6b7280;width:38%;font-size:14px;">Atendido por</td>
                        <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{empleado}</td>
                      </tr>
""";
            var seccionCta = string.IsNullOrEmpty(urlCita) ? "" : $"""
                  <div style="text-align:center;margin:0 0 20px;">
                    <a href="{urlCita}" style="background:#c8a961;color:#1e293b;font-weight:700;font-size:15px;padding:14px 36px;border-radius:9px;text-decoration:none;display:inline-block;">Ver mi cita →</a>
                  </div>
""";
            var seccionCalendario = (!esPendiente && (icalUrl is not null || googleCalUrl is not null)) ? $"""
                  <div style="text-align:center;margin:0 0 20px;">
                    {(googleCalUrl is not null ? $"""<a href="{googleCalUrl}" style="background:#f1f5f9;color:#475569;font-size:13px;font-weight:600;padding:10px 22px;border-radius:8px;text-decoration:none;border:1px solid #e2e8f0;display:inline-block;margin:0 4px;">📅 Google Calendar</a>""" : "")}
                    {(icalUrl is not null ? $"""<a href="{icalUrl}" style="background:#f1f5f9;color:#475569;font-size:13px;font-weight:600;padding:10px 22px;border-radius:8px;text-decoration:none;border:1px solid #e2e8f0;display:inline-block;margin:0 4px;">🍎 iCal / Apple</a>""" : "")}
                  </div>
""" : "";
            var seccionCancelacion = string.IsNullOrEmpty(urlCancelacion) ? "" : $"""
                  <div style="text-align:center;margin:0 0 20px;">
                    <a href="{urlCancelacion}" style="background:#f1f5f9;color:#475569;font-size:13px;font-weight:600;padding:10px 22px;border-radius:8px;text-decoration:none;border:1px solid #e2e8f0;display:inline-block;margin:0 4px;">Cancelar mi cita</a>
                  </div>
""";
            var footerLinkCancelacion = string.IsNullOrEmpty(urlCancelacion) ? "" : $"""<a href="{urlCancelacion}" style="color:#64748b;text-decoration:none;">Cancelar mi cita</a> · """;

            return $"""
                <!DOCTYPE html>
                <html lang="es">
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;padding:20px 0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                  <div style="max-width:600px;margin:0 auto;">
                    <div style="height:4px;background:{stripeColor};font-size:0;"></div>
                    <div style="background:#0f172a;padding:28px 40px 24px;">
                      <span style="font-size:18px;"><span style="color:#ffffff;font-weight:800;">Appoint</span><span style="color:#c8a961;font-weight:800;">Va</span></span>
                    </div>
                    <div style="background:#ffffff;padding:32px 40px 36px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
                      <table style="margin-bottom:20px;" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="width:52px;vertical-align:middle;">
                            <div style="width:44px;height:44px;background:{iconBg};border-radius:12px;text-align:center;line-height:44px;font-size:22px;">{iconEmoji}</div>
                          </td>
                          <td style="vertical-align:middle;padding-left:14px;">
                            <div style="font-size:20px;font-weight:800;color:#0f172a;">{tituloHeader}</div>
                          </td>
                        </tr>
                      </table>
                      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 24px;">Hola, <strong>{nombreCliente}</strong>. {textoIntro}</p>
                      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding:10px 12px;background:#f8fafc;color:#6b7280;width:38%;font-size:14px;">Servicio</td>
                          <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{servicio}</td>
                        </tr>
                        {filaEmpleado}
                        <tr>
                          <td style="padding:10px 12px;background:#f8fafc;color:#6b7280;font-size:14px;">Fecha</td>
                          <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{inicio}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 12px;background:#f8fafc;color:#6b7280;font-size:14px;">Hora</td>
                          <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{hora}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 12px;background:#f8fafc;color:#6b7280;font-size:14px;">Precio</td>
                          <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{precio}</td>
                        </tr>
                      </table>
                      <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;padding:16px 20px;text-align:center;margin-bottom:24px;">
                        <div style="font-size:10px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Código de confirmación</div>
                        <div style="font-size:27px;font-weight:800;color:#c8a961;letter-spacing:6px;">{cita.CodigoConfirmacion}</div>
                      </div>
                      {seccionCta}
                      {seccionCalendario}
                      {seccionCancelacion}
                      <div style="background:#f8fafc;border-radius:9px;padding:16px 18px;font-size:14px;color:#475569;line-height:1.6;">
                        ¿Necesitas cambiar algo? Puedes <strong style="color:#1e293b;">reagendar o cancelar</strong> tu cita hasta 24 horas antes.
                      </div>
                    </div>
                    <div style="background:#0f172a;padding:20px 40px;text-align:center;">
                      <div style="font-size:14px;font-weight:700;margin-bottom:7px;"><span style="color:#94a3b8;">Appoint</span><span style="color:#c8a961;">Va</span></div>
                      <div style="font-size:11px;color:#475569;line-height:1.8;">{negocio} · {footerLinkCancelacion}<a href="mailto:hola@appointva.com" style="color:#64748b;text-decoration:none;">hola@appointva.com</a></div>
                    </div>
                  </div>
                </body>
                </html>
                """;
        }

        private static string PlantillaCancelacion(Cita cita, string nombreCliente)
        {
            nombreCliente = nombreCliente.Trim();
            var negocio  = cita.Negocio?.Nombre ?? "el negocio";
            var servicio = cita.Servicio?.Nombre ?? "el servicio";
            var inicio   = cita.InicioEn.ToString("dddd dd 'de' MMMM 'de' yyyy", new System.Globalization.CultureInfo("es-MX"));
            var hora     = $"{cita.InicioEn:HH:mm}";

            var bloqueMotivo = string.IsNullOrEmpty(cita.MotivoCancelacion) ? "" : $"""
                      <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:9px;padding:16px 18px;margin-bottom:24px;">
                        <div style="color:#991b1b;font-weight:600;font-size:14px;margin-bottom:4px;">Motivo de cancelación</div>
                        <div style="color:#7f1d1d;font-size:14px;">{cita.MotivoCancelacion}</div>
                      </div>
""";

            return $"""
                <!DOCTYPE html>
                <html lang="es">
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;padding:20px 0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                  <div style="max-width:600px;margin:0 auto;">
                    <div style="height:4px;background:#ef4444;font-size:0;"></div>
                    <div style="background:#0f172a;padding:28px 40px 24px;">
                      <span style="font-size:18px;"><span style="color:#ffffff;font-weight:800;">Appoint</span><span style="color:#c8a961;font-weight:800;">Va</span></span>
                    </div>
                    <div style="background:#ffffff;padding:32px 40px 36px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
                      <table style="margin-bottom:20px;" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="width:52px;vertical-align:middle;">
                            <div style="width:44px;height:44px;background:rgba(239,68,68,0.15);border-radius:12px;text-align:center;line-height:44px;font-size:22px;">❌</div>
                          </td>
                          <td style="vertical-align:middle;padding-left:14px;">
                            <div style="font-size:20px;font-weight:800;color:#0f172a;">Tu cita fue cancelada</div>
                          </td>
                        </tr>
                      </table>
                      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 24px;">Hola, <strong>{nombreCliente}</strong>. Te confirmamos que tu cita en <strong>{negocio}</strong> ha sido cancelada.</p>
                      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding:10px 12px;background:#f8fafc;color:#6b7280;width:38%;font-size:14px;">Servicio</td>
                          <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{servicio}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 12px;background:#f8fafc;color:#6b7280;font-size:14px;">Fecha</td>
                          <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{inicio}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 12px;background:#f8fafc;color:#6b7280;font-size:14px;">Hora</td>
                          <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{hora}</td>
                        </tr>
                      </table>
                      {bloqueMotivo}
                      <div style="background:#f8fafc;border-radius:9px;padding:16px 18px;font-size:14px;color:#475569;line-height:1.6;">
                        ¿Tienes dudas? Contáctanos en <strong>hola@appointva.com</strong> o directamente con el negocio.
                      </div>
                    </div>
                    <div style="background:#0f172a;padding:20px 40px;text-align:center;">
                      <div style="font-size:14px;font-weight:700;margin-bottom:7px;"><span style="color:#94a3b8;">Appoint</span><span style="color:#c8a961;">Va</span></div>
                      <div style="font-size:11px;color:#475569;line-height:1.8;">{negocio} · <a href="mailto:hola@appointva.com" style="color:#64748b;text-decoration:none;">hola@appointva.com</a></div>
                    </div>
                  </div>
                </body>
                </html>
                """;
        }

        private static string PlantillaRecordatorio(Cita cita, string nombreCliente, string? icalUrl = null, string? googleCalUrl = null)
        {
            nombreCliente = nombreCliente.Trim();
            var negocio  = cita.Negocio?.Nombre ?? "el negocio";
            var servicio = cita.Servicio?.Nombre ?? "el servicio";
            var empleado = cita.Empleado?.Nombre ?? string.Empty;
            var inicio   = cita.InicioEn.ToString("dddd dd 'de' MMMM 'de' yyyy", new System.Globalization.CultureInfo("es-MX"));
            var hora     = $"{cita.InicioEn:HH:mm} – {cita.FinEn:HH:mm} h";

            var filaEmpleado = string.IsNullOrEmpty(empleado) ? "" : $"""
                        <tr>
                          <td style="padding:10px 12px;background:#f8fafc;color:#6b7280;font-size:14px;">Atendido por</td>
                          <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{empleado}</td>
                        </tr>
""";
            var seccionCalendario = (icalUrl is not null || googleCalUrl is not null) ? $"""
                      <div style="text-align:center;margin:0 0 24px;">
                        {(googleCalUrl is not null ? $"""<a href="{googleCalUrl}" style="background:#f1f5f9;color:#475569;font-size:13px;font-weight:600;padding:10px 22px;border-radius:8px;text-decoration:none;border:1px solid #e2e8f0;display:inline-block;margin:0 4px;">📅 Google Calendar</a>""" : "")}
                        {(icalUrl is not null ? $"""<a href="{icalUrl}" style="background:#f1f5f9;color:#475569;font-size:13px;font-weight:600;padding:10px 22px;border-radius:8px;text-decoration:none;border:1px solid #e2e8f0;display:inline-block;margin:0 4px;">🍎 iCal / Apple</a>""" : "")}
                      </div>
""" : "";

            return $"""
                <!DOCTYPE html>
                <html lang="es">
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;padding:20px 0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                  <div style="max-width:600px;margin:0 auto;">
                    <div style="height:4px;background:#f59e0b;font-size:0;"></div>
                    <div style="background:#0f172a;padding:28px 40px 24px;">
                      <span style="font-size:18px;"><span style="color:#ffffff;font-weight:800;">Appoint</span><span style="color:#c8a961;font-weight:800;">Va</span></span>
                    </div>
                    <div style="background:#ffffff;padding:32px 40px 36px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
                      <table style="margin-bottom:20px;" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="width:52px;vertical-align:middle;">
                            <div style="width:44px;height:44px;background:rgba(245,158,11,0.15);border-radius:12px;text-align:center;line-height:44px;font-size:22px;">⏰</div>
                          </td>
                          <td style="vertical-align:middle;padding-left:14px;">
                            <div style="font-size:20px;font-weight:800;color:#0f172a;">Recordatorio de cita</div>
                          </td>
                        </tr>
                      </table>
                      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 24px;">Hola, <strong>{nombreCliente}</strong>. Te recordamos que tu cita en <strong>{negocio}</strong> es <strong>mañana</strong>. ¡Ya casi!</p>
                      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding:10px 12px;background:#f8fafc;color:#6b7280;width:38%;font-size:14px;">Servicio</td>
                          <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{servicio}</td>
                        </tr>
                        {filaEmpleado}
                        <tr>
                          <td style="padding:10px 12px;background:#f8fafc;color:#6b7280;font-size:14px;">Fecha</td>
                          <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{inicio}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 12px;background:#f8fafc;color:#6b7280;font-size:14px;">Hora</td>
                          <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{hora}</td>
                        </tr>
                      </table>
                      <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;padding:16px 20px;text-align:center;margin-bottom:24px;">
                        <div style="font-size:10px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Tu código de confirmación</div>
                        <div style="font-size:27px;font-weight:800;color:#c8a961;letter-spacing:6px;">{cita.CodigoConfirmacion}</div>
                      </div>
                      {seccionCalendario}
                    </div>
                    <div style="background:#0f172a;padding:20px 40px;text-align:center;">
                      <div style="font-size:14px;font-weight:700;margin-bottom:7px;"><span style="color:#94a3b8;">Appoint</span><span style="color:#c8a961;">Va</span></div>
                      <div style="font-size:11px;color:#475569;line-height:1.8;">{negocio} · <a href="mailto:hola@appointva.com" style="color:#64748b;text-decoration:none;">hola@appointva.com</a></div>
                    </div>
                  </div>
                </body>
                </html>
                """;
        }

        private static string PlantillaReagendar(Cita cita, string nombreCliente, DateTime fechaOriginal)
        {
            nombreCliente    = nombreCliente.Trim();
            var negocio      = cita.Negocio?.Nombre ?? "el negocio";
            var servicio     = cita.Servicio?.Nombre ?? "el servicio";
            var empleado     = cita.Empleado?.Nombre ?? string.Empty;
            var nuevaFecha   = cita.InicioEn.ToString("dddd dd 'de' MMMM 'de' yyyy", new System.Globalization.CultureInfo("es-MX"));
            var nuevaHora    = $"{cita.InicioEn:HH:mm} – {cita.FinEn:HH:mm} h";
            var fechaOriginalStr = fechaOriginal.ToString("dddd dd 'de' MMMM 'de' yyyy", new System.Globalization.CultureInfo("es-MX")) + " " + fechaOriginal.ToString("HH:mm");

            var filaEmpleado = string.IsNullOrEmpty(empleado) ? "" : $"""
                        <tr>
                          <td style="padding:10px 12px;background:#f8fafc;color:#6b7280;font-size:14px;">Atendido por</td>
                          <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{empleado}</td>
                        </tr>
""";

            return $"""
                <!DOCTYPE html>
                <html lang="es">
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;padding:20px 0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                  <div style="max-width:600px;margin:0 auto;">
                    <div style="height:4px;background:#3b82f6;font-size:0;"></div>
                    <div style="background:#0f172a;padding:28px 40px 24px;">
                      <span style="font-size:18px;"><span style="color:#ffffff;font-weight:800;">Appoint</span><span style="color:#c8a961;font-weight:800;">Va</span></span>
                    </div>
                    <div style="background:#ffffff;padding:32px 40px 36px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
                      <table style="margin-bottom:20px;" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="width:52px;vertical-align:middle;">
                            <div style="width:44px;height:44px;background:rgba(59,130,246,0.15);border-radius:12px;text-align:center;line-height:44px;font-size:22px;">🔄</div>
                          </td>
                          <td style="vertical-align:middle;padding-left:14px;">
                            <div style="font-size:20px;font-weight:800;color:#0f172a;">Tu cita fue reagendada</div>
                          </td>
                        </tr>
                      </table>
                      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 24px;">Hola, <strong>{nombreCliente}</strong>. Tu cita en <strong>{negocio}</strong> fue cambiada de fecha. Aquí están los detalles actualizados.</p>
                      <div style="background:#f8fafc;border-radius:9px;padding:14px 18px;margin-bottom:12px;">
                        <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">Fecha anterior</div>
                        <div style="font-size:15px;text-decoration:line-through;color:#9ca3af;">{fechaOriginalStr}</div>
                      </div>
                      <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:9px;padding:14px 18px;margin-bottom:24px;">
                        <div style="font-size:12px;color:#166534;margin-bottom:4px;">Nueva fecha</div>
                        <div style="font-size:15px;color:#166534;font-weight:700;">{nuevaFecha} · {nuevaHora}</div>
                      </div>
                      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding:10px 12px;background:#f8fafc;color:#6b7280;width:38%;font-size:14px;">Servicio</td>
                          <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{servicio}</td>
                        </tr>
                        {filaEmpleado}
                      </table>
                      <div style="background:#f8fafc;border-radius:9px;padding:16px 18px;font-size:14px;color:#475569;line-height:1.6;">
                        Tu código de confirmación sigue siendo: <strong style="color:#c8a961;letter-spacing:3px;">{cita.CodigoConfirmacion}</strong>
                      </div>
                    </div>
                    <div style="background:#0f172a;padding:20px 40px;text-align:center;">
                      <div style="font-size:14px;font-weight:700;margin-bottom:7px;"><span style="color:#94a3b8;">Appoint</span><span style="color:#c8a961;">Va</span></div>
                      <div style="font-size:11px;color:#475569;line-height:1.8;">{negocio} · <a href="mailto:hola@appointva.com" style="color:#64748b;text-decoration:none;">hola@appointva.com</a></div>
                    </div>
                  </div>
                </body>
                </html>
                """;
        }

        private static string PlantillaSolicitudResena(Cita cita, string nombreCliente, string urlResena)
        {
            var negocio  = cita.Negocio?.Nombre ?? "el negocio";
            var servicio = cita.Servicio?.Nombre ?? "el servicio";

            return $"""
                <!DOCTYPE html>
                <html lang="es">
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;padding:20px 0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                  <div style="max-width:600px;margin:0 auto;">
                    <div style="height:4px;background:#c8a961;font-size:0;"></div>
                    <div style="background:#0f172a;padding:28px 40px 24px;">
                      <span style="font-size:18px;"><span style="color:#ffffff;font-weight:800;">Appoint</span><span style="color:#c8a961;font-weight:800;">Va</span></span>
                    </div>
                    <div style="background:#ffffff;padding:32px 40px 36px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
                      <table style="margin-bottom:20px;" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="width:52px;vertical-align:middle;">
                            <div style="width:44px;height:44px;background:rgba(200,169,97,0.15);border-radius:12px;text-align:center;line-height:44px;font-size:22px;">⭐</div>
                          </td>
                          <td style="vertical-align:middle;padding-left:14px;">
                            <div style="font-size:20px;font-weight:800;color:#0f172a;">¿Cómo fue tu experiencia?</div>
                          </td>
                        </tr>
                      </table>
                      <div style="font-size:30px;letter-spacing:2px;text-align:center;margin-bottom:20px;">⭐⭐⭐⭐⭐</div>
                      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 24px;">Hola, <strong>{nombreCliente}</strong>. Gracias por visitar <strong>{negocio}</strong>. Tu opinión nos ayuda a seguir mejorando.</p>
                      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding:10px 12px;background:#f8fafc;color:#6b7280;width:38%;font-size:14px;">Servicio</td>
                          <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{servicio}</td>
                        </tr>
                      </table>
                      <div style="text-align:center;margin:0 0 20px;">
                        <a href="{urlResena}" style="background:#c8a961;color:#1e293b;font-weight:700;font-size:15px;padding:14px 36px;border-radius:9px;text-decoration:none;display:inline-block;">Dejar mi reseña →</a>
                      </div>
                      <div style="background:#f8fafc;border-radius:9px;padding:16px 18px;font-size:14px;color:#475569;line-height:1.6;text-align:center;">
                        Este enlace expira en <strong>7 días</strong>. Solo toma 1 minuto.
                      </div>
                    </div>
                    <div style="background:#0f172a;padding:20px 40px;text-align:center;">
                      <div style="font-size:14px;font-weight:700;margin-bottom:7px;"><span style="color:#94a3b8;">Appoint</span><span style="color:#c8a961;">Va</span></div>
                      <div style="font-size:11px;color:#475569;line-height:1.8;">{negocio} · <a href="mailto:hola@appointva.com" style="color:#64748b;text-decoration:none;">hola@appointva.com</a></div>
                    </div>
                  </div>
                </body>
                </html>
                """;
        }

        private static string PlantillaListaEspera(string nombreCliente, string nombreNegocio, string nombreServicio, string urlReserva)
        {
            return $"""
                <!DOCTYPE html>
                <html lang="es">
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;padding:20px 0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                  <div style="max-width:600px;margin:0 auto;">
                    <div style="height:4px;background:#22c55e;font-size:0;"></div>
                    <div style="background:#0f172a;padding:28px 40px 24px;">
                      <span style="font-size:18px;"><span style="color:#ffffff;font-weight:800;">Appoint</span><span style="color:#c8a961;font-weight:800;">Va</span></span>
                    </div>
                    <div style="background:#ffffff;padding:32px 40px 36px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
                      <table style="margin-bottom:20px;" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="width:52px;vertical-align:middle;">
                            <div style="width:44px;height:44px;background:rgba(34,197,94,0.15);border-radius:12px;text-align:center;line-height:44px;font-size:22px;">🎉</div>
                          </td>
                          <td style="vertical-align:middle;padding-left:14px;">
                            <div style="font-size:20px;font-weight:800;color:#0f172a;">¡Hay un lugar disponible!</div>
                          </td>
                        </tr>
                      </table>
                      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 20px;">Hola, <strong>{nombreCliente.Trim()}</strong>. Estabas en la lista de espera de <strong>{nombreNegocio}</strong> y se liberó un lugar para ti.</p>
                      <div style="text-align:center;margin-bottom:20px;">
                        <span style="background:#fef3c7;color:#92400e;font-size:13px;font-weight:700;padding:6px 16px;border-radius:99px;border:1px solid #fde68a;display:inline-block;">⏱ Tienes 2 horas para reservar</span>
                      </div>
                      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding:10px 12px;background:#f8fafc;color:#6b7280;width:38%;font-size:14px;">Servicio</td>
                          <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{nombreServicio}</td>
                        </tr>
                      </table>
                      <div style="text-align:center;margin:0 0 20px;">
                        <a href="{urlReserva}" style="background:#c8a961;color:#1e293b;font-weight:700;font-size:15px;padding:14px 36px;border-radius:9px;text-decoration:none;display:inline-block;">Reservar mi lugar →</a>
                      </div>
                      <div style="background:#f8fafc;border-radius:9px;padding:16px 18px;font-size:14px;color:#475569;line-height:1.6;">
                        Si no reservas en las próximas 2 horas, el lugar pasará al siguiente en lista.
                      </div>
                    </div>
                    <div style="background:#0f172a;padding:20px 40px;text-align:center;">
                      <div style="font-size:14px;font-weight:700;margin-bottom:7px;"><span style="color:#94a3b8;">Appoint</span><span style="color:#c8a961;">Va</span></div>
                      <div style="font-size:11px;color:#475569;line-height:1.8;">{nombreNegocio} · <a href="mailto:hola@appointva.com" style="color:#64748b;text-decoration:none;">hola@appointva.com</a></div>
                    </div>
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
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;padding:20px 0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                  <div style="max-width:600px;margin:0 auto;">
                    <div style="height:4px;background:#8b5cf6;font-size:0;"></div>
                    <div style="background:#0f172a;padding:28px 40px 24px;">
                      <span style="font-size:18px;"><span style="color:#ffffff;font-weight:800;">Appoint</span><span style="color:#c8a961;font-weight:800;">Va</span></span>
                    </div>
                    <div style="background:#ffffff;padding:32px 40px 36px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
                      <table style="margin-bottom:20px;" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="width:52px;vertical-align:middle;">
                            <div style="width:44px;height:44px;background:rgba(139,92,246,0.15);border-radius:12px;text-align:center;line-height:44px;font-size:22px;">🔑</div>
                          </td>
                          <td style="vertical-align:middle;padding-left:14px;">
                            <div style="font-size:20px;font-weight:800;color:#0f172a;">Recupera tu contraseña</div>
                          </td>
                        </tr>
                      </table>
                      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 24px;">Hola. Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>AppointVa</strong>.</p>
                      <div style="background:#f8fafc;border-radius:9px;padding:16px 18px;font-size:14px;color:#475569;line-height:1.6;margin-bottom:24px;">
                        Si no solicitaste este cambio, puedes ignorar este correo con total seguridad. Tu contraseña actual no se modificará.
                      </div>
                      <div style="text-align:center;margin:0 0 24px;">
                        <a href="{urlReset}" style="background:#c8a961;color:#1e293b;font-weight:700;font-size:15px;padding:14px 36px;border-radius:9px;text-decoration:none;display:inline-block;">Restablecer contraseña →</a>
                      </div>
                      <div style="background:#f8fafc;border-radius:9px;padding:16px 18px;font-size:14px;color:#475569;line-height:1.6;">
                        Este enlace es válido por <strong>1 hora</strong>.<br>Si el botón no funciona, copia este enlace en tu navegador:<br><span style="color:#64748b;font-size:12px;word-break:break-all;">{urlReset}</span>
                      </div>
                    </div>
                    <div style="background:#0f172a;padding:20px 40px;text-align:center;">
                      <div style="font-size:14px;font-weight:700;margin-bottom:7px;"><span style="color:#94a3b8;">Appoint</span><span style="color:#c8a961;">Va</span></div>
                      <div style="font-size:11px;color:#475569;line-height:1.8;"><a href="mailto:hola@appointva.com" style="color:#64748b;text-decoration:none;">hola@appointva.com</a></div>
                    </div>
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
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;padding:20px 0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                  <div style="max-width:600px;margin:0 auto;">
                    <div style="height:4px;background:#c8a961;font-size:0;"></div>
                    <div style="background:#0f172a;padding:28px 40px 24px;">
                      <span style="font-size:18px;"><span style="color:#ffffff;font-weight:800;">Appoint</span><span style="color:#c8a961;font-weight:800;">Va</span></span>
                    </div>
                    <div style="background:#ffffff;padding:32px 40px 36px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
                      <table style="margin-bottom:20px;" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="width:52px;vertical-align:middle;">
                            <div style="width:44px;height:44px;background:rgba(200,169,97,0.15);border-radius:12px;text-align:center;line-height:44px;font-size:22px;">✉️</div>
                          </td>
                          <td style="vertical-align:middle;padding-left:14px;">
                            <div style="font-size:20px;font-weight:800;color:#0f172a;">Verifica tu correo electrónico</div>
                          </td>
                        </tr>
                      </table>
                      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 24px;">Hola, <strong>{nombre}</strong>. Gracias por registrar tu negocio en AppointVa. Solo falta un paso para activar tu cuenta.</p>
                      <div style="text-align:center;margin:0 0 24px;">
                        <a href="{urlVerificacion}" style="background:#c8a961;color:#1e293b;font-weight:700;font-size:15px;padding:14px 36px;border-radius:9px;text-decoration:none;display:inline-block;">Verificar mi correo →</a>
                      </div>
                      <div style="background:#f8fafc;border-radius:9px;padding:16px 18px;font-size:14px;color:#475569;line-height:1.6;margin-bottom:16px;">
                        Este enlace es válido por <strong>24 horas</strong>.<br>Si el botón no funciona, copia este enlace en tu navegador:<br><span style="color:#64748b;font-size:12px;word-break:break-all;">{urlVerificacion}</span>
                      </div>
                      <div style="background:#f8fafc;border-radius:9px;padding:16px 18px;font-size:14px;color:#475569;line-height:1.6;">
                        Si no creaste una cuenta en AppointVa, puedes ignorar este correo.
                      </div>
                    </div>
                    <div style="background:#0f172a;padding:20px 40px;text-align:center;">
                      <div style="font-size:14px;font-weight:700;margin-bottom:7px;"><span style="color:#94a3b8;">Appoint</span><span style="color:#c8a961;">Va</span></div>
                      <div style="font-size:11px;color:#475569;line-height:1.8;"><a href="mailto:hola@appointva.com" style="color:#64748b;text-decoration:none;">hola@appointva.com</a></div>
                    </div>
                  </div>
                </body>
                </html>
                """;
        }

        private static string PlantillaBienvenida(string nombre, string negocioNombre, string urlReservas, string urlDashboard)
        {
            return $"""
                <!DOCTYPE html>
                <html lang="es">
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;padding:20px 0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                  <div style="max-width:600px;margin:0 auto;">
                    <div style="height:4px;background:#c8a961;font-size:0;"></div>
                    <div style="background:#0f172a;padding:28px 40px 24px;">
                      <span style="font-size:18px;"><span style="color:#ffffff;font-weight:800;">Appoint</span><span style="color:#c8a961;font-weight:800;">Va</span></span>
                    </div>
                    <div style="background:#ffffff;padding:32px 40px 36px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
                      <table style="margin-bottom:20px;" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="width:52px;vertical-align:middle;">
                            <div style="width:44px;height:44px;background:rgba(200,169,97,0.20);border-radius:12px;text-align:center;line-height:44px;font-size:22px;">🎉</div>
                          </td>
                          <td style="vertical-align:middle;padding-left:14px;">
                            <div style="font-size:20px;font-weight:800;color:#0f172a;">¡Bienvenido a AppointVa, {nombre}!</div>
                          </td>
                        </tr>
                      </table>
                      <p style="font-size:16px;color:#374151;line-height:1.6;margin:0 0 24px;">Tu negocio ya tiene su propio sistema de reservas en línea.<br><br>A partir de hoy, tus clientes pueden agendar <strong>24 horas al día, los 7 días de la semana</strong> — sin llamadas, sin mensajes de WhatsApp a medianoche, sin complicaciones. Tú ves todo desde tu panel en tiempo real.</p>
                      <div style="height:1px;background:#f1f5f9;margin:0 0 26px;font-size:0;"></div>
                      <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">Configúralo en 3 pasos</div>
                      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="width:40px;vertical-align:top;padding-top:2px;">
                            <div style="background:#0f172a;color:#c8a961;font-size:13px;font-weight:800;width:28px;height:28px;border-radius:8px;text-align:center;line-height:28px;">1</div>
                          </td>
                          <td style="vertical-align:top;padding-left:12px;padding-bottom:14px;">
                            <div style="font-size:14px;color:#111827;font-weight:700;margin-bottom:2px;">Agrega tus servicios</div>
                            <div style="font-size:13px;color:#6b7280;line-height:1.5;">Define nombre, precio y duración. Tus clientes verán exactamente qué ofreces y cuánto cuesta.</div>
                          </td>
                        </tr>
                        <tr>
                          <td style="width:40px;vertical-align:top;padding-top:2px;">
                            <div style="background:#0f172a;color:#c8a961;font-size:13px;font-weight:800;width:28px;height:28px;border-radius:8px;text-align:center;line-height:28px;">2</div>
                          </td>
                          <td style="vertical-align:top;padding-left:12px;padding-bottom:14px;">
                            <div style="font-size:14px;color:#111827;font-weight:700;margin-bottom:2px;">Configura tus horarios</div>
                            <div style="font-size:13px;color:#6b7280;line-height:1.5;">Indica los días y horas en que atiendes. AppointVa bloquea automáticamente los turnos ocupados.</div>
                          </td>
                        </tr>
                        <tr>
                          <td style="width:40px;vertical-align:top;padding-top:2px;">
                            <div style="background:#0f172a;color:#c8a961;font-size:13px;font-weight:800;width:28px;height:28px;border-radius:8px;text-align:center;line-height:28px;">3</div>
                          </td>
                          <td style="vertical-align:top;padding-left:12px;">
                            <div style="font-size:14px;color:#111827;font-weight:700;margin-bottom:2px;">Comparte tu enlace de reservas</div>
                            <div style="font-size:13px;color:#6b7280;line-height:1.5;">Tu página ya está lista en <a href="{urlReservas}" style="color:#c8a961;font-weight:700;text-decoration:none;">{urlReservas}</a>. Ponla en Instagram, WhatsApp y Google.</div>
                          </td>
                        </tr>
                      </table>
                      <div style="height:1px;background:#f1f5f9;margin:0 0 26px;font-size:0;"></div>
                      <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">Tips para recibir más reservas desde el día 1</div>
                      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;background:#f8fafc;border-radius:10px;" cellpadding="14" cellspacing="0" border="0">
                        <tr>
                          <td style="width:36px;font-size:22px;vertical-align:top;">📸</td>
                          <td style="vertical-align:top;padding-left:8px;">
                            <div style="font-size:14px;color:#111827;font-weight:700;margin-bottom:2px;">Agrega fotos de tu trabajo</div>
                            <div style="font-size:13px;color:#6b7280;line-height:1.5;">Los negocios con galería reciben hasta 3× más reservas. Sube tus mejores trabajos desde Galería en tu panel.</div>
                          </td>
                        </tr>
                      </table>
                      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;background:#f8fafc;border-radius:10px;" cellpadding="14" cellspacing="0" border="0">
                        <tr>
                          <td style="width:36px;font-size:22px;vertical-align:top;">💬</td>
                          <td style="vertical-align:top;padding-left:8px;">
                            <div style="font-size:14px;color:#111827;font-weight:700;margin-bottom:2px;">Comparte tu link en tus redes</div>
                            <div style="font-size:13px;color:#6b7280;line-height:1.5;">Ponlo en la bio de Instagram, en tu estado de WhatsApp y en tu perfil de Google. Funciona 24/7.</div>
                          </td>
                        </tr>
                      </table>
                      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#f8fafc;border-radius:10px;" cellpadding="14" cellspacing="0" border="0">
                        <tr>
                          <td style="width:36px;font-size:22px;vertical-align:top;">⏰</td>
                          <td style="vertical-align:top;padding-left:8px;">
                            <div style="font-size:14px;color:#111827;font-weight:700;margin-bottom:2px;">Activa los recordatorios automáticos</div>
                            <div style="font-size:13px;color:#6b7280;line-height:1.5;">AppointVa avisa a tus clientes un día antes de su cita. Reduce inasistencias sin que tengas que hacer nada.</div>
                          </td>
                        </tr>
                      </table>
                      <div style="text-align:center;margin:0 0 24px;">
                        <a href="{urlDashboard}" style="background:#c8a961;color:#1e293b;font-weight:700;font-size:15px;padding:14px 36px;border-radius:9px;text-decoration:none;display:inline-block;">Ir a mi panel →</a>
                      </div>
                      <div style="height:1px;background:#f1f5f9;margin:0 0 24px;font-size:0;"></div>
                      <table style="width:100%;border-collapse:collapse;background:#0f172a;border-radius:10px;" cellpadding="16" cellspacing="0" border="0">
                        <tr>
                          <td style="width:40px;font-size:22px;vertical-align:top;">🤝</td>
                          <td style="vertical-align:top;padding-left:10px;">
                            <div style="font-size:14px;color:#ffffff;font-weight:700;margin-bottom:4px;">Estamos aquí para ayudarte</div>
                            <div style="font-size:13px;color:#94a3b8;line-height:1.5;">¿Tienes dudas? Escríbenos a <span style="color:#c8a961;font-weight:600;">hola@appointva.com</span> — respondemos en menos de 24 horas.</div>
                          </td>
                        </tr>
                      </table>
                    </div>
                    <div style="background:#0f172a;padding:20px 40px;text-align:center;">
                      <div style="font-size:14px;font-weight:700;margin-bottom:7px;"><span style="color:#94a3b8;">Appoint</span><span style="color:#c8a961;">Va</span></div>
                      <div style="font-size:11px;color:#475569;line-height:1.8;"><a href="mailto:hola@appointva.com" style="color:#64748b;text-decoration:none;">hola@appointva.com</a> · <a href="https://appointva.com" style="color:#64748b;text-decoration:none;">appointva.com</a></div>
                    </div>
                  </div>
                </body>
                </html>
                """;
        }
    }
}
