using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;
using Microsoft.EntityFrameworkCore;
using WebPush;

namespace AppointVaAPI.Services
{
    public class PushService : IPushService
    {
        private readonly ApplicationDbContext _db;
        private readonly IConfiguration _config;
        private readonly ILogger<PushService> _logger;

        public PushService(ApplicationDbContext db, IConfiguration config, ILogger<PushService> logger)
        {
            _db = db;
            _config = config;
            _logger = logger;
        }

        public async Task GuardarSuscripcionAsync(Guid usuarioId, string endpoint, string p256dh, string auth)
        {
            var existente = await _db.PushSuscripciones.FirstOrDefaultAsync(s => s.UsuarioId == usuarioId);
            if (existente is not null)
            {
                existente.Endpoint = endpoint;
                existente.P256dh = p256dh;
                existente.Auth = auth;
                existente.ActualizadaEn = DateTime.UtcNow;
            }
            else
            {
                _db.PushSuscripciones.Add(new PushSuscripcion
                {
                    Id = Guid.NewGuid(),
                    UsuarioId = usuarioId,
                    Endpoint = endpoint,
                    P256dh = p256dh,
                    Auth = auth,
                });
            }
            await _db.SaveChangesAsync();
        }

        public async Task EliminarSuscripcionAsync(Guid usuarioId)
        {
            var suscripcion = await _db.PushSuscripciones.FirstOrDefaultAsync(s => s.UsuarioId == usuarioId);
            if (suscripcion is not null)
            {
                _db.PushSuscripciones.Remove(suscripcion);
                await _db.SaveChangesAsync();
            }
        }

        public async Task EnviarNuevaCitaEmpleadoAsync(Guid citaId)
        {
            // Cargar cita completa — este método se ejecuta en un job de Hangfire (scope propio)
            var cita = await _db.Citas
                .Include(c => c.Cliente)
                .Include(c => c.Servicio)
                .Include(c => c.Negocio)
                .Include(c => c.Empleado)
                .FirstOrDefaultAsync(c => c.Id == citaId);

            if (cita is null) return;

            var backendUrl = _config["BackendUrl"] ?? string.Empty;
            var icalUrl = string.IsNullOrWhiteSpace(backendUrl) ? null
                : $"{backendUrl}/api/publico/citas/{cita.CodigoConfirmacion}/ical";
            var googleCalUrl = BuildGoogleCalendarUrl(cita);
            var payload = BuildPayloadNuevaCita(cita, icalUrl, googleCalUrl);

            // Notificar al empleado asignado (si aplica)
            if (cita.EmpleadoId != Guid.Empty)
            {
                var empleado = await _db.Empleados
                    .FirstOrDefaultAsync(e => e.Id == cita.EmpleadoId);

                if (empleado?.UsuarioId is not null)
                {
                    var subEmpleado = await _db.PushSuscripciones
                        .FirstOrDefaultAsync(s => s.UsuarioId == empleado.UsuarioId.Value);
                    if (subEmpleado is not null)
                        await EnviarAsync(subEmpleado, payload);
                }
            }

            // Notificar al propietario del negocio
            var roleId = await _db.Roles
                .Where(r => r.Name == Constants.Roles.Propietario)
                .Select(r => r.Id)
                .FirstOrDefaultAsync();

            if (roleId == Guid.Empty) return;

            var propietarioIds = await _db.UserRoles
                .Where(ur => ur.RoleId == roleId)
                .Select(ur => ur.UserId)
                .ToListAsync();

            var propietarios = await _db.Users
                .Where(u => u.NegocioId == cita.NegocioId && propietarioIds.Contains(u.Id) && u.Activo)
                .ToListAsync();

            foreach (var propietario in propietarios)
            {
                var subProp = await _db.PushSuscripciones
                    .FirstOrDefaultAsync(s => s.UsuarioId == propietario.Id);
                if (subProp is not null)
                    await EnviarAsync(subProp, payload);
            }
        }

        public async Task<string> EnviarPruebaAsync(Guid usuarioId)
        {
            var suscripcion = await _db.PushSuscripciones
                .FirstOrDefaultAsync(s => s.UsuarioId == usuarioId);

            if (suscripcion is null)
                return "sin_suscripcion";

            var payload = System.Text.Json.JsonSerializer.Serialize(new
            {
                title = "AppointVa · Prueba ✅",
                body = "Las notificaciones push funcionan correctamente.",
                url = "/dashboard/perfil",
                icalUrl = (string?)null,
                googleCalUrl = (string?)null
            });

            await EnviarAsync(suscripcion, payload);
            return "enviada";
        }

        private async Task EnviarAsync(PushSuscripcion suscripcion, string payload)
        {
            var publicKey = _config["Push:VapidPublicKey"];
            var privateKey = _config["Push:VapidPrivateKey"];
            var subject = _config["Push:VapidSubject"] ?? "mailto:hola@appointva.com";

            if (string.IsNullOrWhiteSpace(publicKey) || string.IsNullOrWhiteSpace(privateKey))
            {
                _logger.LogWarning("VAPID keys no configuradas. Push notification omitida.");
                return;
            }

            try
            {
                var sub = new PushSubscription(suscripcion.Endpoint, suscripcion.P256dh, suscripcion.Auth);
                var vapid = new VapidDetails(subject, publicKey, privateKey);
                var client = new WebPushClient();
                await client.SendNotificationAsync(sub, payload, vapid);
            }
            catch (WebPushException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Gone
                                           || ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                // Suscripción expirada — limpiar
                _db.PushSuscripciones.Remove(suscripcion);
                await _db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error enviando push notification a {Endpoint}", suscripcion.Endpoint);
            }
        }

        private static string BuildPayloadNuevaCita(Cita cita, string? icalUrl, string? googleCalUrl)
        {
            var cliente = cita.Cliente?.NombreCompleto ?? "Un cliente";
            var servicio = cita.Servicio?.Nombre ?? "Servicio";
            var negocio = cita.Negocio?.Nombre ?? "AppointVa";
            var hora = cita.InicioEn.ToString("HH:mm");
            var fecha = cita.InicioEn.ToString("dd/MM/yyyy");

            return System.Text.Json.JsonSerializer.Serialize(new
            {
                title = $"Nueva cita — {negocio}",
                body = $"{cliente} · {servicio} · {fecha} {hora}",
                url = "/citas",
                icalUrl,
                googleCalUrl
            });
        }

        private static string BuildGoogleCalendarUrl(Cita cita)
        {
            var titulo = Uri.EscapeDataString(
                $"{cita.Servicio?.Nombre ?? "Cita"} — {cita.Negocio?.Nombre ?? "AppointVa"}");
            var inicio = cita.InicioEn.ToString("yyyyMMddTHHmmssZ");
            var fin = cita.FinEn.ToString("yyyyMMddTHHmmssZ");
            var detalles = Uri.EscapeDataString(
                $"Cliente: {cita.Cliente?.NombreCompleto ?? "—"}\nTel: {cita.Cliente?.Telefono ?? "—"}");
            return $"https://calendar.google.com/calendar/render?action=TEMPLATE&text={titulo}&dates={inicio}/{fin}&details={detalles}";
        }
    }
}
