using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Citas;
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

            var tzEmail = AppointVaAPI.Helpers.ZonaHorariaHelper.Resolver(cita.Negocio?.ZonaHoraria);
            var hoyLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tzEmail).Date;
            var diasHasta = (cita.InicioEn.Date - hoyLocal).TotalDays;
            var cuandoTexto = diasHasta switch { <= 0 => "hoy", 1 => "mañana", _ => "pronto" };
            var asunto = $"Recordatorio: tu cita es {cuandoTexto} — {cita.Servicio?.Nombre ?? "AppointVa"}";
            var html = PlantillaRecordatorio(cita, nombreCliente, cuandoTexto, icalUrl, googleCalUrl);
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
                    subject = LimpiarAsunto(asunto),
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

        internal static string PlantillaConfirmacion(Cita cita, string nombreCliente, string? urlCita = null, string? icalUrl = null, string? googleCalUrl = null, string? urlCancelacion = null, bool esPendiente = false)
        {
            nombreCliente = Html(nombreCliente.Trim());
            var negocio  = Html(cita.Negocio?.Nombre ?? "el negocio");
            var servicio = Html(cita.Servicio?.Nombre ?? "el servicio");
            var empleado = Html(cita.Empleado?.Nombre);
            var codigo   = Html(cita.CodigoConfirmacion);
            var inicio   = cita.InicioEn.ToString("dddd dd 'de' MMMM 'de' yyyy", new System.Globalization.CultureInfo("es-MX"));
            var horaInicio  = Hora12(cita.InicioEn);
            var duracionMin = (int)(cita.FinEn - cita.InicioEn).TotalMinutes;
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
                    <a href="{Html(urlCita)}" style="background:#c8a961;color:#1e293b;font-weight:700;font-size:15px;padding:14px 36px;border-radius:9px;text-decoration:none;display:inline-block;">Ver mi cita →</a>
                  </div>
""";
            var seccionCalendario = (!esPendiente && (icalUrl is not null || googleCalUrl is not null)) ? $"""
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
        <tr>
          {(googleCalUrl is not null ? $"""
          <td width="{(icalUrl is not null ? "50%" : "100%")}" style="{(icalUrl is not null ? "padding-right:6px;" : "")}">
            <a href="{Html(googleCalUrl)}" style="display:block;background:#f1f5f9;color:#475569;font-size:13px;font-weight:600;padding:11px 8px;border-radius:8px;text-decoration:none;border:1px solid #e2e8f0;text-align:center;box-sizing:border-box;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" style="display:inline-block;vertical-align:middle;margin-right:6px;" role="img" aria-label="Google Calendar"><path d="M18.316 5.684H24v12.632h-5.684V5.684zM5.684 24h12.632v-5.684H5.684V24zM18.316 5.684V0H1.895A1.894 1.894 0 0 0 0 1.895v16.421h5.684V5.684h12.632zm-7.207 6.25v-.065c.272-.144.5-.349.687-.617s.279-.595.279-.982c0-.379-.099-.72-.3-1.025a2.05 2.05 0 0 0-.832-.714 2.703 2.703 0 0 0-1.197-.257c-.6 0-1.094.156-1.481.467-.386.311-.65.671-.793 1.078l1.085.452c.086-.249.224-.461.413-.633.189-.172.445-.257.767-.257.33 0 .602.088.816.264a.86.86 0 0 1 .322.703c0 .33-.12.589-.36.778-.24.19-.535.284-.886.284h-.567v1.085h.633c.407 0 .748.109 1.02.327.272.218.407.499.407.843 0 .336-.129.614-.387.832s-.565.327-.924.327c-.351 0-.651-.103-.897-.311-.248-.208-.422-.502-.521-.881l-1.096.452c.178.616.505 1.082.977 1.401.472.319.984.478 1.538.477a2.84 2.84 0 0 0 1.293-.291c.382-.193.684-.458.902-.794.218-.336.327-.72.327-1.149 0-.429-.115-.797-.344-1.105a2.067 2.067 0 0 0-.881-.689zm2.093-1.931l.602.913L15 10.045v5.744h1.187V8.446h-.827l-2.158 1.557zM22.105 0h-3.289v5.184H24V1.895A1.894 1.894 0 0 0 22.105 0zm-3.289 23.5l4.684-4.684h-4.684V23.5zM0 22.105C0 23.152.848 24 1.895 24h3.289v-5.184H0v3.289z" fill="#1a73e8"/></svg>Google Calendar
            </a>
          </td>
          """ : "")}
          {(icalUrl is not null ? $"""
          <td width="{(googleCalUrl is not null ? "50%" : "100%")}" style="{(googleCalUrl is not null ? "padding-left:6px;" : "")}">
            <a href="{Html(icalUrl)}" style="display:block;background:#f1f5f9;color:#475569;font-size:13px;font-weight:600;padding:11px 8px;border-radius:8px;text-decoration:none;border:1px solid #e2e8f0;text-align:center;box-sizing:border-box;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" style="display:inline-block;vertical-align:middle;margin-right:6px;" role="img" aria-label="Apple"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" fill="#000000"/></svg>iCal / Apple
            </a>
          </td>
          """ : "")}
        </tr>
      </table>
""" : "";
            var seccionCancelacion = string.IsNullOrEmpty(urlCancelacion) ? "" : $"""
                  <div style="text-align:center;margin:0 0 20px;">
                    <a href="{Html(urlCancelacion)}" style="background:#f1f5f9;color:#475569;font-size:13px;font-weight:600;padding:10px 22px;border-radius:8px;text-decoration:none;border:1px solid #e2e8f0;display:inline-block;margin:0 4px;">Cancelar mi cita</a>
                  </div>
""";
            var footerLinkCancelacion = string.IsNullOrEmpty(urlCancelacion) ? "" : $"""<a href="{Html(urlCancelacion)}" style="color:#64748b;text-decoration:none;">Cancelar mi cita</a> · """;

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
                          <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{horaInicio}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 12px;background:#f8fafc;color:#6b7280;font-size:14px;">Duración</td>
                          <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{duracionMin} min</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 12px;background:#f8fafc;color:#6b7280;font-size:14px;">Precio</td>
                          <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{precio}</td>
                        </tr>
                      </table>
                      <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;padding:16px 20px;text-align:center;margin-bottom:24px;">
                        <div style="font-size:10px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Código de confirmación</div>
                        <div style="font-size:27px;font-weight:800;color:#c8a961;letter-spacing:6px;">{codigo}</div>
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

        /// <summary>
        /// Spanish 12-hour time, the same wording the front shows: "4:00 p.m.", "9:05 a.m.".
        /// Built by hand instead of with a culture so the output does not depend on the
        /// ICU data installed on the server. The value is shown as-is: appointment times
        /// are already the business's local wall time, so no zone conversion here.
        /// </summary>
        internal static string Hora12(DateTime dt)
        {
            var hora = dt.Hour % 12 == 0 ? 12 : dt.Hour % 12;
            var periodo = dt.Hour < 12 ? "a.m." : "p.m.";
            return $"{hora}:{dt.Minute:00} {periodo}";
        }

        /// <summary>
        /// Escapes a value for HTML text or a quoted attribute. Only the five markup
        /// characters are escaped (WebUtility.HtmlEncode would also turn every accent
        /// into a numeric entity, which is valid but noisy in Spanish text).
        /// </summary>
        internal static string Html(string? valor)
        {
            if (string.IsNullOrEmpty(valor)) return string.Empty;
            return valor
                .Replace("&", "&amp;")
                .Replace("<", "&lt;")
                .Replace(">", "&gt;")
                .Replace("\"", "&quot;")
                .Replace("'", "&#39;");
        }

        /// <summary>
        /// Subjects are plain text (no HTML encoding), but a CR or LF coming from a
        /// business or service name must never reach the mail header.
        /// </summary>
        internal static string LimpiarAsunto(string asunto) =>
            string.Join(" ", asunto.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries)).Trim();

        internal static string PlantillaCancelacion(Cita cita, string nombreCliente)
        {
            nombreCliente = Html(nombreCliente.Trim());
            var negocio  = Html(cita.Negocio?.Nombre ?? "el negocio");
            var servicio = Html(cita.Servicio?.Nombre ?? "el servicio");
            var motivo   = Html(cita.MotivoCancelacion);
            var inicio   = cita.InicioEn.ToString("dddd dd 'de' MMMM 'de' yyyy", new System.Globalization.CultureInfo("es-MX"));
            var hora     = Hora12(cita.InicioEn);

            var bloqueMotivo = string.IsNullOrEmpty(motivo) ? "" : $"""
                      <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:9px;padding:16px 18px;margin-bottom:24px;">
                        <div style="color:#991b1b;font-weight:600;font-size:14px;margin-bottom:4px;">Motivo de cancelación</div>
                        <div style="color:#7f1d1d;font-size:14px;">{motivo}</div>
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

        internal static string PlantillaRecordatorio(Cita cita, string nombreCliente, string cuandoTexto, string? icalUrl = null, string? googleCalUrl = null)
        {
            nombreCliente = Html(nombreCliente.Trim());
            var negocio  = Html(cita.Negocio?.Nombre ?? "el negocio");
            var servicio = Html(cita.Servicio?.Nombre ?? "el servicio");
            var empleado = Html(cita.Empleado?.Nombre);
            var codigo   = Html(cita.CodigoConfirmacion);
            var inicio   = cita.InicioEn.ToString("dddd dd 'de' MMMM 'de' yyyy", new System.Globalization.CultureInfo("es-MX"));
            var horaInicio  = Hora12(cita.InicioEn);
            var duracionMin = (int)(cita.FinEn - cita.InicioEn).TotalMinutes;

            var filaEmpleado = string.IsNullOrEmpty(empleado) ? "" : $"""
                        <tr>
                          <td style="padding:10px 12px;background:#f8fafc;color:#6b7280;font-size:14px;">Atendido por</td>
                          <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{empleado}</td>
                        </tr>
""";
            var seccionCalendario = (icalUrl is not null || googleCalUrl is not null) ? $"""
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
        <tr>
          {(googleCalUrl is not null ? $"""
          <td width="{(icalUrl is not null ? "50%" : "100%")}" style="{(icalUrl is not null ? "padding-right:6px;" : "")}">
            <a href="{Html(googleCalUrl)}" style="display:block;background:#f1f5f9;color:#475569;font-size:13px;font-weight:600;padding:11px 8px;border-radius:8px;text-decoration:none;border:1px solid #e2e8f0;text-align:center;box-sizing:border-box;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" style="display:inline-block;vertical-align:middle;margin-right:6px;" role="img" aria-label="Google Calendar"><path d="M18.316 5.684H24v12.632h-5.684V5.684zM5.684 24h12.632v-5.684H5.684V24zM18.316 5.684V0H1.895A1.894 1.894 0 0 0 0 1.895v16.421h5.684V5.684h12.632zm-7.207 6.25v-.065c.272-.144.5-.349.687-.617s.279-.595.279-.982c0-.379-.099-.72-.3-1.025a2.05 2.05 0 0 0-.832-.714 2.703 2.703 0 0 0-1.197-.257c-.6 0-1.094.156-1.481.467-.386.311-.65.671-.793 1.078l1.085.452c.086-.249.224-.461.413-.633.189-.172.445-.257.767-.257.33 0 .602.088.816.264a.86.86 0 0 1 .322.703c0 .33-.12.589-.36.778-.24.19-.535.284-.886.284h-.567v1.085h.633c.407 0 .748.109 1.02.327.272.218.407.499.407.843 0 .336-.129.614-.387.832s-.565.327-.924.327c-.351 0-.651-.103-.897-.311-.248-.208-.422-.502-.521-.881l-1.096.452c.178.616.505 1.082.977 1.401.472.319.984.478 1.538.477a2.84 2.84 0 0 0 1.293-.291c.382-.193.684-.458.902-.794.218-.336.327-.72.327-1.149 0-.429-.115-.797-.344-1.105a2.067 2.067 0 0 0-.881-.689zm2.093-1.931l.602.913L15 10.045v5.744h1.187V8.446h-.827l-2.158 1.557zM22.105 0h-3.289v5.184H24V1.895A1.894 1.894 0 0 0 22.105 0zm-3.289 23.5l4.684-4.684h-4.684V23.5zM0 22.105C0 23.152.848 24 1.895 24h3.289v-5.184H0v3.289z" fill="#1a73e8"/></svg>Google Calendar
            </a>
          </td>
          """ : "")}
          {(icalUrl is not null ? $"""
          <td width="{(googleCalUrl is not null ? "50%" : "100%")}" style="{(googleCalUrl is not null ? "padding-left:6px;" : "")}">
            <a href="{Html(icalUrl)}" style="display:block;background:#f1f5f9;color:#475569;font-size:13px;font-weight:600;padding:11px 8px;border-radius:8px;text-decoration:none;border:1px solid #e2e8f0;text-align:center;box-sizing:border-box;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" style="display:inline-block;vertical-align:middle;margin-right:6px;" role="img" aria-label="Apple"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" fill="#000000"/></svg>iCal / Apple
            </a>
          </td>
          """ : "")}
        </tr>
      </table>
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
                      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 24px;">Hola, <strong>{nombreCliente}</strong>. Te recordamos que tu cita en <strong>{negocio}</strong> es <strong>{cuandoTexto}</strong>. ¡Ya casi!</p>
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
                          <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{horaInicio}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 12px;background:#f8fafc;color:#6b7280;font-size:14px;">Duración</td>
                          <td style="padding:10px 12px;color:#111827;font-weight:600;font-size:14px;">{duracionMin} min</td>
                        </tr>
                      </table>
                      <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;padding:16px 20px;text-align:center;margin-bottom:24px;">
                        <div style="font-size:10px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Tu código de confirmación</div>
                        <div style="font-size:27px;font-weight:800;color:#c8a961;letter-spacing:6px;">{codigo}</div>
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

        internal static string PlantillaReagendar(Cita cita, string nombreCliente, DateTime fechaOriginal)
        {
            nombreCliente    = Html(nombreCliente.Trim());
            var negocio      = Html(cita.Negocio?.Nombre ?? "el negocio");
            var servicio     = Html(cita.Servicio?.Nombre ?? "el servicio");
            var empleado     = Html(cita.Empleado?.Nombre);
            var codigo       = Html(cita.CodigoConfirmacion);
            var nuevaFecha   = cita.InicioEn.ToString("dddd dd 'de' MMMM 'de' yyyy", new System.Globalization.CultureInfo("es-MX"));
            var nuevaHora    = $"{Hora12(cita.InicioEn)} – {Hora12(cita.FinEn)}";
            var fechaOriginalStr = fechaOriginal.ToString("dddd dd 'de' MMMM 'de' yyyy", new System.Globalization.CultureInfo("es-MX")) + " " + Hora12(fechaOriginal);

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
                        Tu código de confirmación sigue siendo: <strong style="color:#c8a961;letter-spacing:3px;">{codigo}</strong>
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

        internal static string PlantillaSolicitudResena(Cita cita, string nombreCliente, string urlResena)
        {
            nombreCliente = Html(nombreCliente.Trim());
            var negocio  = Html(cita.Negocio?.Nombre ?? "el negocio");
            var servicio = Html(cita.Servicio?.Nombre ?? "el servicio");

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
                        <a href="{Html(urlResena)}" style="background:#c8a961;color:#1e293b;font-weight:700;font-size:15px;padding:14px 36px;border-radius:9px;text-decoration:none;display:inline-block;">Dejar mi reseña →</a>
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

        internal static string PlantillaListaEspera(string nombreCliente, string nombreNegocio, string nombreServicio, string urlReserva)
        {
            nombreCliente  = Html(nombreCliente.Trim());
            nombreNegocio  = Html(nombreNegocio);
            nombreServicio = Html(nombreServicio);
            urlReserva     = Html(urlReserva);
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
                      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 20px;">Hola, <strong>{nombreCliente}</strong>. Estabas en la lista de espera de <strong>{nombreNegocio}</strong> y se liberó un lugar para ti.</p>
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

        internal static string PlantillaRecuperacion(string nombre, string urlReset)
        {
            urlReset = Html(urlReset);
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

        internal static string PlantillaVerificacion(string nombre, string urlVerificacion)
        {
            nombre          = Html(nombre);
            urlVerificacion = Html(urlVerificacion);
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

        internal static string PlantillaBienvenida(string nombre, string negocioNombre, string urlReservas, string urlDashboard)
        {
            nombre       = Html(nombre);
            urlReservas  = Html(urlReservas);
            urlDashboard = Html(urlDashboard);
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

        public async Task EnviarTicketCitaAsync(string destinoEmail, TicketCitaDatos datos)
        {
            if (!EstaHabilitado()) return;
            var html = PlantillaTicket(datos);
            await EnviarAsync(destinoEmail, $"Comprobante de pago — {datos.NegocioNombre}", html);
        }

        /// <summary>"$1,280.00": always with cents, without depending on the server's ICU data.</summary>
        internal static string Dinero(decimal monto) =>
            "$" + monto.ToString("N2", System.Globalization.CultureInfo.InvariantCulture);

        /// <summary>One receipt row: label and amount, the amount already formatted ("-$30.00").</summary>
        internal sealed record RenglonTicket(string Etiqueta, string Monto, bool Destacado = false);

        /// <summary>
        /// The receipt's numbers, row by row. Same rules as the printed ticket
        /// (Front/src/utils/ticketRecibo.ts resumirTicket); both are pinned by the shared
        /// vectors in AppointVaAPI.Tests/Fixtures/ticket-vectores.json.
        /// </summary>
        internal sealed record ResumenTicket(
            decimal PrecioLista, decimal DescuentoCupon, decimal DescuentoCaja, decimal CargoAdicional,
            decimal Anticipo, decimal SaldoAFavor, decimal Total,
            IReadOnlyList<RenglonTicket> Totales, RenglonTicket? FilaSaldoAFavor,
            IReadOnlyList<RenglonTicket> Pagos, string EtiquetaEmpleado);

        private static decimal Centavos(decimal monto) => Math.Round(monto, 2, MidpointRounding.AwayFromZero);

        /// <summary>"10", "12.5": the coupon percentage as written on the receipt.</summary>
        internal static string Porcentaje(decimal pct) =>
            Centavos(pct).ToString("0.##", System.Globalization.CultureInfo.InvariantCulture);

        /// <summary>
        /// Splits the payment into rows that close on paper:
        /// Subtotal − Descuento − Descuento en caja − Anticipo (+ Cargo adicional) = TOTAL.
        /// <list type="bullet">
        /// <item>The coupon comes only from the amounts stored at booking (PrecioLista):
        /// an appointment without them shows no coupon, whatever the service costs today.</item>
        /// <item>Charging less than what was due at the counter shows as "Descuento en caja";
        /// charging more, as "Cargo adicional".</item>
        /// <item>An advance larger than what was due is applied only up to the price
        /// ("Anticipo aplicado"); the rest is shown after the TOTAL as "Saldo a favor",
        /// never as a charge.</item>
        /// <item>The tip has its own row and is never added to the TOTAL.</item>
        /// </list>
        /// </summary>
        internal static ResumenTicket ResumirTicket(TicketCitaDatos d)
        {
            var precio = Centavos(d.Precio);
            var precioLista = d.PrecioLista is { } lista && Centavos(lista) > precio ? Centavos(lista) : precio;
            var anticipoTotal = d.AnticipoRecibido && d.MontoAnticipo is { } a && Centavos(a) > 0 ? Centavos(a) : 0m;
            var anticipo = Math.Min(anticipoTotal, precio);
            var saldoAFavor = anticipoTotal - anticipo;
            var cobrado = Centavos(Math.Max(0m, d.MontoCobrado ?? precio - anticipo));

            var descuentoCupon = precioLista - precio;
            var diferenciaCaja = precio - anticipo - cobrado;
            var descuentoCaja = Math.Max(0m, diferenciaCaja);
            var cargo = Math.Max(0m, -diferenciaCaja);

            var totales = new List<RenglonTicket>();
            if (descuentoCupon > 0 || descuentoCaja > 0 || cargo > 0 || anticipoTotal > 0)
                totales.Add(new("Subtotal", Dinero(precioLista)));
            if (descuentoCupon > 0)
            {
                var etiqueta = d.DescuentoPorcentaje is { } pct && pct > 0 ? $"Descuento {Porcentaje(pct)}%" : "Descuento";
                totales.Add(new(etiqueta, "-" + Dinero(descuentoCupon)));
            }
            if (descuentoCaja > 0) totales.Add(new("Descuento en caja", "-" + Dinero(descuentoCaja)));
            if (cargo > 0) totales.Add(new("Cargo adicional", Dinero(cargo)));
            if (anticipoTotal > 0)
                totales.Add(new(saldoAFavor > 0 ? "Anticipo aplicado" : "Anticipo pagado", "-" + Dinero(anticipo)));

            // Split payment: the first method covers what the second one did not.
            var metodo1 = string.IsNullOrWhiteSpace(d.MetodoPago) ? "Pago" : d.MetodoPago.Trim();
            var metodo2 = d.MetodoPago2?.Trim() ?? "";
            var m2 = metodo2.Length > 0 && d.MontoPago2 is { } p2 && Centavos(p2) > 0 ? Centavos(p2) : 0m;
            var pagos = new List<RenglonTicket>();
            if (m2 > 0)
            {
                pagos.Add(new(metodo1, Dinero(Math.Max(0m, cobrado - m2))));
                pagos.Add(new(metodo2, Dinero(m2)));
            }
            else
            {
                pagos.Add(new(metodo1, Dinero(cobrado)));
            }
            var hayEfectivo = metodo1 == "Efectivo" || (m2 > 0 && metodo2 == "Efectivo");
            if (hayEfectivo && d.MontoRecibido is { } recibido && Centavos(recibido) > 0)
                pagos.Add(new("Recibido", Dinero(Centavos(recibido))));
            if (hayEfectivo && d.Cambio is { } cambio && Centavos(cambio) > 0)
                pagos.Add(new("Cambio", Dinero(Centavos(cambio)), Destacado: true));
            if (d.Propina is { } propina && Centavos(propina) > 0)
                pagos.Add(new("Propina", Dinero(Centavos(propina))));

            return new ResumenTicket(
                precioLista, descuentoCupon, descuentoCaja, cargo, anticipo, saldoAFavor, cobrado,
                totales,
                saldoAFavor > 0 ? new RenglonTicket("Saldo a favor", Dinero(saldoAFavor)) : null,
                pagos,
                EtiquetaEmpleado(d.Sector));
        }

        /// <summary>
        /// Who attended: the sector's term in health businesses (Front's useSectorTerms:
        /// TERMINOS_SALUD.empleado), "Atendió" everywhere else.
        /// </summary>
        internal static string EtiquetaEmpleado(string? sector) => sector == "salud" ? "Profesional" : "Atendió";

        internal static string PlantillaTicket(TicketCitaDatos d)
        {
            var r = ResumirTicket(d);
            var cliente   = Html(d.ClienteNombre.Trim());
            var negocio   = Html(d.NegocioNombre);
            var folio     = Html(d.Folio);
            var servicio  = Html(d.Servicio);
            var empleado  = Html(d.EmpleadoNombre);
            var fechaTexto = d.InicioEn.ToString("dddd dd 'de' MMMM 'de' yyyy", new System.Globalization.CultureInfo("es-MX"));
            var fecha = Html(fechaTexto.Length > 0 ? char.ToUpper(fechaTexto[0]) + fechaTexto[1..] : fechaTexto);
            var hora  = Hora12(d.InicioEn);
            var duracion = d.DuracionMinutos > 0 ? $" · {d.DuracionMinutos} min" : "";

            const string celdaEtiqueta = "padding:6px 0;color:#64748b;font-size:14px;";
            const string celdaValor    = "padding:6px 0;color:#0f172a;font-size:14px;text-align:right;";
            string Fila(string etiqueta, string valor, bool fuerte = false) => $"""
                        <tr>
                          <td style="{celdaEtiqueta}">{etiqueta}</td>
                          <td style="{celdaValor}{(fuerte ? "font-weight:700;" : "")}">{valor}</td>
                        </tr>
""";

            var logo = d.NegocioLogoUrl is { } url && (url.StartsWith("https://", StringComparison.OrdinalIgnoreCase) || url.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
                ? $"""<img src="{Html(url)}" alt="{negocio}" style="display:block;margin:0 auto 12px;max-height:64px;max-width:180px;height:auto;border:0;">"""
                : "";
            var direccion = string.IsNullOrWhiteSpace(d.NegocioDireccion) ? "" :
                $"""<div style="font-size:13px;color:#64748b;line-height:1.5;">{Html(d.NegocioDireccion.Trim())}</div>""";
            var telefono = string.IsNullOrWhiteSpace(d.NegocioTelefono) ? "" :
                $"""<div style="font-size:13px;color:#64748b;line-height:1.5;">Tel. {Html(d.NegocioTelefono.Trim())}</div>""";

            var datos = new StringBuilder()
                .Append(Fila("Folio", folio, fuerte: true))
                .Append(Fila("Fecha", fecha))
                .Append(Fila("Hora", hora));
            if (!string.IsNullOrEmpty(empleado)) datos.Append(Fila(r.EtiquetaEmpleado, empleado));

            var totales = new StringBuilder();
            foreach (var t in r.Totales) totales.Append(Fila(Html(t.Etiqueta), t.Monto, t.Destacado));
            var saldoAFavor = r.FilaSaldoAFavor is { } s ? Fila(s.Etiqueta, s.Monto) : "";

            var pagos = new StringBuilder();
            foreach (var p in r.Pagos) pagos.Append(Fila(Html(p.Etiqueta), p.Monto, p.Destacado));

            var reservar = string.IsNullOrEmpty(d.UrlReserva) ? "" : $"""
                      <div style="text-align:center;margin:28px 0 8px;">
                        <a href="{Html(d.UrlReserva)}" style="background:#0f172a;color:#ffffff;font-weight:700;font-size:15px;padding:13px 32px;border-radius:9px;text-decoration:none;display:inline-block;">Reserva tu próxima cita</a>
                      </div>
""";
            const string separador = """<div style="border-top:1px dashed #cbd5e1;margin:18px 0;font-size:0;line-height:0;">&nbsp;</div>""";

            return $"""
                <!DOCTYPE html>
                <html lang="es">
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                  <div style="max-width:520px;margin:0 auto;">
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px 32px 28px;">
                      <div style="text-align:center;">
                        {logo}
                        <div style="font-size:20px;font-weight:800;color:#0f172a;line-height:1.3;">{negocio}</div>
                        {direccion}
                        {telefono}
                      </div>
                      {separador}
                      <div style="text-align:center;font-size:12px;font-weight:700;color:#475569;letter-spacing:1.5px;text-transform:uppercase;">Comprobante de pago</div>
                      <p style="font-size:15px;color:#334155;line-height:1.6;margin:14px 0 6px;text-align:center;">Hola, <strong>{cliente}</strong>. Este es el comprobante de tu pago.</p>
                      {separador}
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                        {datos}
                      </table>
                      {separador}
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                        <tr>
                          <td style="padding:6px 0;color:#0f172a;font-size:15px;font-weight:600;">{servicio}<span style="color:#64748b;font-weight:400;">{duracion}</span></td>
                          <td style="padding:6px 0;color:#0f172a;font-size:15px;text-align:right;white-space:nowrap;">{Dinero(r.PrecioLista)}</td>
                        </tr>
                      </table>
                      {separador}
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                        {totales}
                        <tr>
                          <td style="padding:10px 0 4px;color:#0f172a;font-size:18px;font-weight:800;">TOTAL</td>
                          <td style="padding:10px 0 4px;color:#0f172a;font-size:24px;font-weight:800;text-align:right;white-space:nowrap;">{Dinero(r.Total)}</td>
                        </tr>
                        {saldoAFavor}
                      </table>
                      {separador}
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                        {pagos}
                      </table>
                      {reservar}
                      <p style="text-align:center;font-size:15px;font-weight:700;color:#0f172a;margin:20px 0 0;">Gracias por tu visita</p>
                    </div>
                    <div style="text-align:center;padding:18px 12px 0;font-size:11px;color:#94a3b8;line-height:1.6;">
                      Agenda en línea con <span style="font-weight:700;color:#94a3b8;">AppointVa</span> · <a href="https://appointva.com" style="color:#94a3b8;text-decoration:underline;">appointva.com</a>
                    </div>
                  </div>
                </body>
                </html>
                """;
        }
    }
}
