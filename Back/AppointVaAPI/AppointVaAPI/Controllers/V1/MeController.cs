using AppointVaAPI.Constants;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    [Route("api/me")]
    [Authorize(Roles = $"{Roles.Propietario},{Roles.Empleado}")]
    public class MeController : ControllerBase
    {
        private readonly IPushService _push;

        public MeController(IPushService push)
        {
            _push = push;
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

        // POST api/me/push-test
        [HttpPost("push-test")]
        public async Task<IActionResult> ProbarPush()
        {
            var resultado = await _push.EnviarPruebaAsync(UserId);
            return resultado switch
            {
                "sin_suscripcion" => NotFound(new { mensaje = "No hay suscripción push guardada para este usuario." }),
                "enviada" => Ok(new { mensaje = "Notificación de prueba enviada." }),
                _ => StatusCode(500, new { mensaje = "Error desconocido." })
            };
        }
    }

    public record PushSuscripcionDto(string Endpoint, string P256dh, string Auth);
}
