using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models.Dtos.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    [Route("api/admin/audit")]
    [Authorize(Roles = Roles.SuperAdmin)]
    public class AuditAdminController : ControllerBase
    {
        private readonly ApplicationDbContext _db;

        public AuditAdminController(ApplicationDbContext db)
        {
            _db = db;
        }

        // GET /api/admin/audit?pagina=1&tamano=50&accion=Login&usuarioId=...
        [HttpGet]
        public async Task<IActionResult> ObtenerAuditLogs(
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 50,
            [FromQuery] string? accion = null,
            [FromQuery] Guid? usuarioId = null)
        {
            tamano = Math.Min(tamano, 200);
            pagina = Math.Max(pagina, 1);

            var query = _db.AuditLogs
                .Include(a => a.Usuario)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(accion))
                query = query.Where(a => a.Accion == accion);

            if (usuarioId.HasValue)
                query = query.Where(a => a.UsuarioId == usuarioId);

            var total = await query.CountAsync();

            var datos = await query
                .OrderByDescending(a => a.FechaEn)
                .Skip((pagina - 1) * tamano)
                .Take(tamano)
                .Select(a => new AuditLogDto
                {
                    Id           = a.Id,
                    UsuarioId    = a.UsuarioId,
                    UsuarioEmail = a.Usuario != null ? a.Usuario.Email : null,
                    Accion       = a.Accion,
                    Entidad      = a.Entidad,
                    EntidadId    = a.EntidadId,
                    Detalles     = a.Detalles,
                    IpAddress    = a.IpAddress,
                    FechaEn      = a.FechaEn
                })
                .ToListAsync();

            return Ok(new { total, pagina, tamano, datos });
        }
    }
}
