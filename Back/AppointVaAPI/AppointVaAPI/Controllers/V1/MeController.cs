using AppointVaAPI.Constants;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    [Route("api/me")]
    [Authorize(Roles = $"{Roles.Propietario},{Roles.Empleado}")]
    public class MeController : ControllerBase
    {
        private readonly IPushService _push;
        private readonly IConfiguration _config;

        public MeController(IPushService push, IConfiguration config)
        {
            _push = push;
            _config = config;
        }

        // GET api/me/push-vapid-key  — sin autenticación (la public key no es secreta)
        [HttpGet("push-vapid-key")]
        [AllowAnonymous]
        public IActionResult ObtenerVapidKey()
        {
            var key = _config["Push:VapidPublicKey"];
            if (string.IsNullOrWhiteSpace(key))
                return NotFound(new { mensaje = "VAPID public key no configurada." });
            return Ok(new { vapidPublicKey = key });
        }

        private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // POST api/me/push-subscription
        [HttpPost("push-subscription")]
        public async Task<IActionResult> GuardarSuscripcion([FromBody] PushSuscripcionDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Endpoint) ||
                string.IsNullOrWhiteSpace(dto.P256dh) ||
                string.IsNullOrWhiteSpace(dto.Auth))
                return BadRequest("Suscripción incompleta.");

            await _push.GuardarSuscripcionAsync(UserId, dto.Endpoint, dto.P256dh, dto.Auth);
            return Ok(new { mensaje = "Suscripción guardada." });
        }

        // DELETE api/me/push-subscription
        [HttpDelete("push-subscription")]
        public async Task<IActionResult> EliminarSuscripcion()
        {
            await _push.EliminarSuscripcionAsync(UserId);
            return Ok(new { mensaje = "Suscripción eliminada." });
        }

        // GET api/me/push-status
        [HttpGet("push-status")]
        public async Task<IActionResult> EstadoPush([FromServices] AppointVaAPI.Data.ApplicationDbContext db)
        {
            var suscripcion = await db.PushSuscripciones
                .FirstOrDefaultAsync(s => s.UsuarioId == UserId);

            return Ok(new
            {
                suscriptoEnBd = suscripcion is not null,
                endpoint = suscripcion?.Endpoint?.Substring(0, Math.Min(60, suscripcion.Endpoint.Length)),
                vapidPublicKey = !string.IsNullOrWhiteSpace(_config["Push:VapidPublicKey"]),
                vapidPrivateKey = !string.IsNullOrWhiteSpace(_config["Push:VapidPrivateKey"]),
            });
        }

        // POST api/me/push-test
        [HttpPost("push-test")]
        public async Task<IActionResult> ProbarPush()
        {
            try
            {
                var resultado = await _push.EnviarPruebaAsync(UserId);
                return resultado switch
                {
                    "sin_suscripcion" => NotFound(new { mensaje = "No hay suscripción push guardada para este usuario. Activa las notificaciones primero." }),
                    "enviada" => Ok(new { mensaje = "Notificación de prueba enviada." }),
                    _ => StatusCode(500, new { mensaje = "Error desconocido." })
                };
            }
            catch (Exception ex)
            {
                var inner = ex.InnerException is not null ? $" | inner: {ex.InnerException.GetType().Name}: {ex.InnerException.Message}" : "";
                return StatusCode(500, new { mensaje = $"Error [{ex.GetType().Name}]: {ex.Message}{inner}" });
            }
        }
    }

    public record PushSuscripcionDto(string Endpoint, string P256dh, string Auth);
}
