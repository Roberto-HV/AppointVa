using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    [Route("api/notificaciones")]
    [Authorize(Roles = Roles.Propietario)]
    public class NotificacionesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IContextoNegocio _contexto;

        public NotificacionesController(ApplicationDbContext db, IContextoNegocio contexto)
        {
            _db = db;
            _contexto = contexto;
        }

        [HttpGet]
        public async Task<IActionResult> Listar()
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var notifs = await _db.NotificacionesDashboard
                .Where(n => n.NegocioId == _contexto.NegocioId.Value)
                .OrderByDescending(n => n.FechaCreacion)
                .Take(50)
                .Select(n => new NotificacionDto(
                    n.Id, n.Tipo, n.Titulo, n.Descripcion, n.FechaCreacion, n.Leida, n.CitaId))
                .ToListAsync();

            return Ok(notifs);
        }

        [HttpPut("marcar-leidas")]
        public async Task<IActionResult> MarcarLeidas()
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            await _db.NotificacionesDashboard
                .Where(n => n.NegocioId == _contexto.NegocioId.Value && !n.Leida)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.Leida, true));

            return NoContent();
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Eliminar(Guid id)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var notif = await _db.NotificacionesDashboard
                .FirstOrDefaultAsync(n => n.Id == id && n.NegocioId == _contexto.NegocioId.Value);

            if (notif is null) return NotFound();

            _db.NotificacionesDashboard.Remove(notif);
            await _db.SaveChangesAsync();

            return NoContent();
        }
    }

    public record NotificacionDto(
        Guid Id,
        string Tipo,
        string Titulo,
        string Descripcion,
        DateTime FechaCreacion,
        bool Leida,
        Guid? CitaId
    );
}
