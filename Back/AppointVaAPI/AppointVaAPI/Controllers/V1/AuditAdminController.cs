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

        // GET /api/admin/audit?pagina=1&tamano=50&accion=Login&usuarioId=...&email=...&desde=...&hasta=...
        // B24 (AP-24): `email` matches part of the user's email (case-insensitive);
        // `desde` is inclusive and `hasta` exclusive, both instants (send UTC/ISO 8601).
        [HttpGet]
        public async Task<IActionResult> ObtenerAuditLogs(
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 50,
            [FromQuery] string? accion = null,
            [FromQuery] Guid? usuarioId = null,
            [FromQuery] string? email = null,
            [FromQuery] DateTime? desde = null,
            [FromQuery] DateTime? hasta = null)
        {
            tamano = Math.Clamp(tamano, 1, 200);
            pagina = Math.Max(pagina, 1);

            var desdeUtc = desde.HasValue ? AUtc(desde.Value) : (DateTime?)null;
            var hastaUtc = hasta.HasValue ? AUtc(hasta.Value) : (DateTime?)null;
            if (desdeUtc.HasValue && hastaUtc.HasValue && desdeUtc.Value >= hastaUtc.Value)
                return BadRequest(new { mensaje = "La fecha inicial debe ser anterior a la final." });

            var emailFiltro = email?.Trim().ToLowerInvariant();
            if (emailFiltro is { Length: > 150 })
                return BadRequest(new { mensaje = "El correo es demasiado largo." });

            var query = _db.AuditLogs
                .Include(a => a.Usuario)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(accion))
                query = query.Where(a => a.Accion == accion);

            if (usuarioId.HasValue)
                query = query.Where(a => a.UsuarioId == usuarioId);

            if (!string.IsNullOrEmpty(emailFiltro))
                query = query.Where(a => a.Usuario != null && a.Usuario.Email != null
                    && a.Usuario.Email.ToLower().Contains(emailFiltro));

            if (desdeUtc.HasValue)
                query = query.Where(a => a.FechaEn >= desdeUtc.Value);

            if (hastaUtc.HasValue)
                query = query.Where(a => a.FechaEn < hastaUtc.Value);

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

        // Npgsql only accepts UTC for timestamptz; a value without offset is taken as UTC.
        private static DateTime AUtc(DateTime valor) => valor.Kind switch
        {
            DateTimeKind.Utc => valor,
            DateTimeKind.Local => valor.ToUniversalTime(),
            _ => DateTime.SpecifyKind(valor, DateTimeKind.Utc),
        };
    }
}
