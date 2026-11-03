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

        // GET /api/admin/audit/acciones
        // The catalog of every action the backend writes, with its Spanish label and group.
        // The audit page builds its filter and labels from here (single source).
        [HttpGet("acciones")]
        public IActionResult ObtenerCatalogo() => Ok(new
        {
            grupos = AccionesAuditoria.Grupos.Select(g => new { id = g.Id, etiqueta = g.Etiqueta }),
            acciones = AccionesAuditoria.Catalogo.Select(a => new { accion = a.Accion, etiqueta = a.Etiqueta, grupo = a.Grupo }),
        });

        // GET /api/admin/audit?pagina=1&tamano=50&accion=Login&grupo=administracion&usuarioId=...&email=...&desde=...&hasta=...
        // B24 (AP-24): `email` matches part of the user's email (case-insensitive);
        // `desde` is inclusive and `hasta` exclusive, both instants (send UTC/ISO 8601).
        // `grupo` keeps only the actions of one catalog group (e.g. the admin's own actions).
        [HttpGet]
        public async Task<IActionResult> ObtenerAuditLogs(
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 50,
            [FromQuery] string? accion = null,
            [FromQuery] Guid? usuarioId = null,
            [FromQuery] string? email = null,
            [FromQuery] DateTime? desde = null,
            [FromQuery] DateTime? hasta = null,
            [FromQuery] string? grupo = null)
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

            if (!string.IsNullOrWhiteSpace(grupo))
            {
                if (AccionesAuditoria.Grupos.All(g => g.Id != grupo))
                    return BadRequest(new { mensaje = "El grupo de acciones no existe." });
                var delGrupo = AccionesAuditoria.DelGrupo(grupo);
                query = query.Where(a => delGrupo.Contains(a.Accion));
            }

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

            // Name of the affected business for the admin's entries (one query per page).
            var negocioIds = datos
                .Where(d => d.Entidad == AccionesAuditoria.EntidadNegocio && Guid.TryParse(d.EntidadId, out _))
                .Select(d => Guid.Parse(d.EntidadId!))
                .Distinct()
                .ToList();
            if (negocioIds.Count > 0)
            {
                var nombres = await _db.Negocios
                    .IgnoreQueryFilters()
                    .Where(n => negocioIds.Contains(n.Id))
                    .Select(n => new { n.Id, n.Nombre })
                    .ToDictionaryAsync(n => n.Id.ToString(), n => n.Nombre);
                foreach (var d in datos)
                    if (d.Entidad == AccionesAuditoria.EntidadNegocio && d.EntidadId is not null
                        && nombres.TryGetValue(d.EntidadId, out var nombre))
                        d.NegocioNombre = nombre;
            }

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
