using System.Security.Claims;
using AppointVaAPI.Constants;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    [Route("api/admin/hangfire")]
    [Authorize(Roles = Roles.SuperAdmin)]
    public class HangfireAdminController : ControllerBase
    {
        private readonly IPanelJobsAccesoService _acceso;

        public HangfireAdminController(IPanelJobsAccesoService acceso)
        {
            _acceso = acceso;
        }

        // POST /api/admin/hangfire/ticket
        // S2: issues a 60 s single-use ticket; the front then opens /hangfire-session?ticket=…
        [HttpPost("ticket")]
        public IActionResult EmitirTicket()
        {
            var sub = User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(sub, out var usuarioId)) return Unauthorized();

            Response.Headers.CacheControl = "no-store";
            var ticket = _acceso.EmitirTicket(usuarioId);
            return Ok(new { ticket, expiraEnSegundos = (int)_acceso.DuracionTicket.TotalSeconds });
        }
    }
}
