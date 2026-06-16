using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Repository.IRepository;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    public class IntakeController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IContextoNegocio _contexto;

        public IntakeController(ApplicationDbContext db, IContextoNegocio contexto)
        {
            _db = db;
            _contexto = contexto;
        }

        // ── Dashboard endpoints (propietario) ─────────────────────────────────

        // GET /api/intake/campos
        [HttpGet("api/intake/campos")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
        public async Task<IActionResult> GetCampos([FromQuery] Guid? servicioId)
        {
            var negocioId = _contexto.NegocioId;
            if (negocioId == null || negocioId == Guid.Empty) return Unauthorized();

            var query = _db.CamposIntake
                .Where(c => c.NegocioId == negocioId && c.Activo)
                .AsQueryable();

            if (servicioId.HasValue)
                query = query.Where(c => c.ServicioId == servicioId || c.ServicioId == null);

            var campos = await query
                .OrderBy(c => c.Orden)
                .Select(c => new {
                    c.Id, c.Etiqueta, c.Tipo, c.Opciones,
                    c.Requerido, c.Orden, c.Activo,
                    c.ServicioId,
                    servicioNombre = c.Servicio != null ? c.Servicio.Nombre : null,
                })
                .ToListAsync();

            return Ok(campos);
        }

        // POST /api/intake/campos
        [HttpPost("api/intake/campos")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
        public async Task<IActionResult> CrearCampo([FromBody] CampoIntakeDto dto)
        {
            var negocioId = _contexto.NegocioId;
            if (negocioId == null || negocioId == Guid.Empty) return Unauthorized();

            var maxOrden = await _db.CamposIntake
                .Where(c => c.NegocioId == negocioId)
                .Select(c => (int?)c.Orden)
                .MaxAsync() ?? 0;

            var campo = new CampoIntake
            {
                Id = Guid.NewGuid(),
                NegocioId = negocioId.Value,
                ServicioId = dto.ServicioId,
                Etiqueta = dto.Etiqueta.Trim(),
                Tipo = dto.Tipo,
                Opciones = dto.Opciones,
                Requerido = dto.Requerido,
                Orden = maxOrden + 1,
                Activo = true,
            };

            _db.CamposIntake.Add(campo);
            await _db.SaveChangesAsync();
            return Ok(new { campo.Id, campo.Etiqueta, campo.Tipo, campo.Orden });
        }

        // PUT /api/intake/campos/{id}
        [HttpPut("api/intake/campos/{id:guid}")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
        public async Task<IActionResult> ActualizarCampo(Guid id, [FromBody] CampoIntakeDto dto)
        {
            var negocioId = _contexto.NegocioId;
            if (negocioId == null) return Unauthorized();
            var campo = await _db.CamposIntake.FirstOrDefaultAsync(c => c.Id == id && c.NegocioId == negocioId);
            if (campo == null) return NotFound();

            campo.ServicioId = dto.ServicioId;
            campo.Etiqueta = dto.Etiqueta.Trim();
            campo.Tipo = dto.Tipo;
            campo.Opciones = dto.Opciones;
            campo.Requerido = dto.Requerido;

            await _db.SaveChangesAsync();
            return Ok(new { campo.Id, campo.Etiqueta });
        }

        // DELETE /api/intake/campos/{id}
        [HttpDelete("api/intake/campos/{id:guid}")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
        public async Task<IActionResult> EliminarCampo(Guid id)
        {
            var negocioId = _contexto.NegocioId;
            if (negocioId == null) return Unauthorized();
            var campo = await _db.CamposIntake.FirstOrDefaultAsync(c => c.Id == id && c.NegocioId == negocioId);
            if (campo == null) return NotFound();

            campo.Activo = false;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // PATCH /api/intake/campos/reordenar — recibe [{id, orden}]
        [HttpPatch("api/intake/campos/reordenar")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
        public async Task<IActionResult> Reordenar([FromBody] List<ReordenarCampoDto> items)
        {
            var negocioId = _contexto.NegocioId;
            if (negocioId == null) return Unauthorized();
            var ids = items.Select(i => i.Id).ToList();
            var campos = await _db.CamposIntake
                .Where(c => ids.Contains(c.Id) && c.NegocioId == negocioId)
                .ToListAsync();

            foreach (var item in items)
            {
                var campo = campos.FirstOrDefault(c => c.Id == item.Id);
                if (campo != null) campo.Orden = item.Orden;
            }
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ── Público: obtener campos para booking ──────────────────────────────

        // GET /api/publico/intake/{slug}?servicioId=
        [HttpGet("api/publico/intake/{slug}")]
        public async Task<IActionResult> GetCamposPublico(string slug, [FromQuery] Guid? servicioId)
        {
            var negocio = await _db.Negocios
                .AsNoTracking()
                .FirstOrDefaultAsync(n => n.Slug == slug && n.Activo == 1);
            if (negocio is null) return NotFound();

            var query = _db.CamposIntake
                .Where(c => c.NegocioId == negocio.Id && c.Activo)
                .AsQueryable();

            if (servicioId.HasValue)
                query = query.Where(c => c.ServicioId == null || c.ServicioId == servicioId);
            else
                query = query.Where(c => c.ServicioId == null);

            var campos = await query
                .OrderBy(c => c.Orden)
                .Select(c => new {
                    c.Id, c.Etiqueta, c.Tipo, c.Opciones, c.Requerido,
                })
                .ToListAsync();

            return Ok(campos);
        }

        // POST /api/publico/intake/{citaId} — guardar respuestas después de crear la cita
        [HttpPost("api/publico/intake/{citaId:guid}")]
        public async Task<IActionResult> GuardarRespuestas(Guid citaId, [FromBody] List<RespuestaIntakeDto> respuestas)
        {
            var cita = await _db.Citas.AsNoTracking().FirstOrDefaultAsync(c => c.Id == citaId);
            if (cita is null) return NotFound();

            var campoIds = respuestas.Select(r => r.CampoIntakeId).Distinct().ToList();
            var camposValidos = await _db.CamposIntake
                .Where(c => campoIds.Contains(c.Id) && c.NegocioId == cita.NegocioId && c.Activo)
                .Select(c => c.Id)
                .ToListAsync();

            var entidades = respuestas
                .Where(r => camposValidos.Contains(r.CampoIntakeId))
                .Select(r => new RespuestaIntake
                {
                    Id = Guid.NewGuid(),
                    CitaId = citaId,
                    CampoIntakeId = r.CampoIntakeId,
                    Valor = r.Valor,
                })
                .ToList();

            _db.RespuestasIntake.AddRange(entidades);
            await _db.SaveChangesAsync();
            return Ok(new { guardadas = entidades.Count });
        }

        // GET /api/intake/respuestas/{citaId} — ver respuestas en dashboard
        [HttpGet("api/intake/respuestas/{citaId:guid}")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
        public async Task<IActionResult> GetRespuestas(Guid citaId)
        {
            var negocioId = _contexto.NegocioId;
            var cita = await _db.Citas.AsNoTracking().FirstOrDefaultAsync(c => c.Id == citaId && c.NegocioId == negocioId);
            if (cita is null) return NotFound();

            var respuestas = await _db.RespuestasIntake
                .Where(r => r.CitaId == citaId)
                .Include(r => r.Campo)
                .OrderBy(r => r.Campo!.Orden)
                .Select(r => new {
                    etiqueta = r.Campo!.Etiqueta,
                    tipo = r.Campo.Tipo,
                    r.Valor,
                })
                .ToListAsync();

            return Ok(respuestas);
        }
    }

    public class CampoIntakeDto
    {
        [Required, MaxLength(200)]
        public string Etiqueta { get; set; } = string.Empty;

        [Required]
        public string Tipo { get; set; } = "Texto";

        public string? Opciones { get; set; }

        [Required]
        public bool Requerido { get; set; }

        public Guid? ServicioId { get; set; }
    }

    public record ReordenarCampoDto(Guid Id, int Orden);

    public class RespuestaIntakeDto
    {
        [Required]
        public Guid CampoIntakeId { get; set; }

        public string? Valor { get; set; }
    }
}
