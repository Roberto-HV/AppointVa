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
        private readonly IAuditService _audit;

        public HangfireAdminController(IPanelJobsAccesoService acceso, IAuditService audit)
        {
            _acceso = acceso;
            _audit = audit;
        }

        // POST /api/admin/hangfire/ticket
        // S2: issues a 60 s single-use ticket; the front then opens /hangfire-session?ticket=…
        [HttpPost("ticket")]
        public async Task<IActionResult> EmitirTicket()
        {
            var sub = User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(sub, out var usuarioId)) return Unauthorized();

            Response.Headers.CacheControl = "no-store";
            var ticket = _acceso.EmitirTicket(usuarioId);
            // The panel can re-run or delete any job: who opened it is worth a (best-effort) row.
            await _audit.RegistrarAsync(AccionesAuditoria.PanelTareasAbierto);
            return Ok(new { ticket, expiraEnSegundos = (int)_acceso.DuracionTicket.TotalSeconds });
        }
    }
}
