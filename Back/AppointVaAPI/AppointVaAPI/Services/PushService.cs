using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;
using Lib.Net.Http.WebPush;
using Lib.Net.Http.WebPush.Authentication;
using Microsoft.EntityFrameworkCore;

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

            if (cita.EmpleadoId != Guid.Empty)
            {
                var empleado = await _db.Empleados.FirstOrDefaultAsync(e => e.Id == cita.EmpleadoId);
                if (empleado?.UsuarioId is not null)
                {
                    var subEmpleado = await _db.PushSuscripciones
                        .FirstOrDefaultAsync(s => s.UsuarioId == empleado.UsuarioId.Value);
                    if (subEmpleado is not null)
                        await EnviarAsync(subEmpleado, payload);
                }
            }

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

            if (string.IsNullOrWhiteSpace(suscripcion.P256dh))
                throw new InvalidOperationException("DIAGNÓSTICO: P256dh en BD está vacío");
            if (string.IsNullOrWhiteSpace(suscripcion.Auth))
                throw new InvalidOperationException("DIAGNÓSTICO: Auth en BD está vacío");
            if (string.IsNullOrWhiteSpace(suscripcion.Endpoint))
                throw new InvalidOperationException("DIAGNÓSTICO: Endpoint en BD está vacío");

            var publicKey = _config["Push:VapidPublicKey"];
            var privateKey = _config["Push:VapidPrivateKey"];

            if (string.IsNullOrWhiteSpace(publicKey))
                throw new InvalidOperationException("DIAGNÓSTICO: VAPID public key no configurada (Push__VapidPublicKey en Render)");
            if (string.IsNullOrWhiteSpace(privateKey))
                throw new InvalidOperationException("DIAGNÓSTICO: VAPID private key no configurada (Push__VapidPrivateKey en Render)");

            var payload = System.Text.Json.JsonSerializer.Serialize(new
            {
                title = "AppointVa · Prueba",
                body = "Las notificaciones push funcionan.",
                url = "/dashboard/perfil",
                icalUrl = (string?)null,
                googleCalUrl = (string?)null
            });

            // Propagamos errores para que el controller los muestre
            await EnviarConVapidAsync(suscripcion, payload, publicKey, privateKey);
            return "enviada";
        }

        private async Task EnviarAsync(PushSuscripcion suscripcion, string payload)
        {
            var publicKey = _config["Push:VapidPublicKey"];
            var privateKey = _config["Push:VapidPrivateKey"];

            if (string.IsNullOrWhiteSpace(publicKey) || string.IsNullOrWhiteSpace(privateKey))
            {
                _logger.LogWarning("VAPID keys no configuradas. Push notification omitida.");
                return;
            }

            try
            {
                await EnviarConVapidAsync(suscripcion, payload, publicKey, privateKey);
            }
            catch (PushServiceClientException ex) when (
                ex.StatusCode == System.Net.HttpStatusCode.Gone ||
                ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                _db.PushSuscripciones.Remove(suscripcion);
                await _db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error enviando push notification a {Endpoint}", suscripcion.Endpoint);
            }
        }

        private static async Task EnviarConVapidAsync(PushSuscripcion suscripcion, string payload,
                                                      string publicKey, string privateKey)
        {
            var subject = "mailto:hola@appointva.com";

            var authentication = new VapidAuthentication(publicKey, privateKey)
            {
                Subject = subject
            };

            var sub = new Lib.Net.Http.WebPush.PushSubscription();
            sub.Endpoint = suscripcion.Endpoint;
            sub.SetKey(PushEncryptionKeyName.P256DH, suscripcion.P256dh);
            sub.SetKey(PushEncryptionKeyName.Auth, suscripcion.Auth);

            var message = new PushMessage(payload)
            {
                TimeToLive = 86400
            };

            var client = new PushServiceClient();
            await client.RequestPushMessageDeliveryAsync(sub, message, authentication);
        }

        private static string BuildPayloadNuevaCita(Cita cita, string? icalUrl, string? googleCalUrl)
        {
            var cliente  = cita.Cliente?.NombreCompleto ?? "Un cliente";
            var servicio = cita.Servicio?.Nombre ?? "Servicio";
            var negocio  = cita.Negocio?.Nombre ?? "AppointVa";
            var hora  = cita.InicioEn.ToString("HH:mm");
            var fecha = cita.InicioEn.ToString("dd/MM/yyyy");

            return System.Text.Json.JsonSerializer.Serialize(new
            {
                title = $"Nueva cita — {negocio}",
                body  = $"{cliente} · {servicio} · {fecha} {hora}",
                url   = "/citas",
                icalUrl,
                googleCalUrl
            });
        }

        private static string BuildGoogleCalendarUrl(Cita cita)
        {
            var titulo = Uri.EscapeDataString(
                $"{cita.Servicio?.Nombre ?? "Cita"} — {cita.Negocio?.Nombre ?? "AppointVa"}");
            var inicio   = cita.InicioEn.ToString("yyyyMMddTHHmmssZ");
            var fin      = cita.FinEn.ToString("yyyyMMddTHHmmssZ");
            var detalles = Uri.EscapeDataString(
                $"Cliente: {cita.Cliente?.NombreCompleto ?? "—"}\nTel: {cita.Cliente?.Telefono ?? "—"}");
            return $"https://calendar.google.com/calendar/render?action=TEMPLATE&text={titulo}&dates={inicio}/{fin}&details={detalles}";
        }
    }
}
