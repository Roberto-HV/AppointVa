using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    public class DescuentosController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IContextoNegocio _contexto;

        public DescuentosController(ApplicationDbContext db, IContextoNegocio contexto)
        {
            _db = db;
            _contexto = contexto;
        }

        // ── Dashboard (propietario) ───────────────────────────────────────────

        // GET /api/descuentos
        [HttpGet("api/descuentos")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
        public async Task<IActionResult> GetDescuentos()
        {
            var negocioId = _contexto.NegocioId;
            if (negocioId == null) return Unauthorized();

            var descuentos = await _db.Descuentos
                .Where(d => d.NegocioId == negocioId && d.Activo)
                .OrderByDescending(d => d.FechaCreacion)
                .Select(d => new {
                    d.Id, d.Codigo, d.Descripcion, d.Tipo, d.Valor,
                    d.UsoMaximo, d.UsoActual, d.FechaExpiracion, d.Activo,
                    agotado = d.UsoMaximo.HasValue && d.UsoActual >= d.UsoMaximo,
                    expirado = d.FechaExpiracion.HasValue && d.FechaExpiracion < DateTime.UtcNow,
                })
                .ToListAsync();

            return Ok(descuentos);
        }

        // POST /api/descuentos
        [HttpPost("api/descuentos")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
        public async Task<IActionResult> Crear([FromBody] DescuentoDto dto)
        {
            var negocioId = _contexto.NegocioId;
            if (negocioId == null) return Unauthorized();

            var codigoNorm = dto.Codigo.Trim().ToUpper();

            var existe = await _db.Descuentos.AnyAsync(d =>
                d.NegocioId == negocioId && d.Codigo == codigoNorm && d.Activo);
            if (existe)
                return BadRequest(new { mensaje = "Ya existe un descuento activo con ese código." });

            var descuento = new Descuento
            {
                Id = Guid.NewGuid(),
                NegocioId = negocioId.Value,
                Codigo = codigoNorm,
                Descripcion = dto.Descripcion?.Trim(),
                Tipo = dto.Tipo,
                Valor = dto.Valor,
                UsoMaximo = dto.UsoMaximo,
                FechaExpiracion = dto.FechaExpiracion,
                Activo = true,
                FechaCreacion = DateTime.UtcNow,
            };

            _db.Descuentos.Add(descuento);
            await _db.SaveChangesAsync();
            return Ok(new { descuento.Id, descuento.Codigo, descuento.Tipo, descuento.Valor });
        }

        // DELETE /api/descuentos/{id}
        [HttpDelete("api/descuentos/{id:guid}")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
        public async Task<IActionResult> Eliminar(Guid id)
        {
            var negocioId = _contexto.NegocioId;
            if (negocioId == null) return Unauthorized();

            var descuento = await _db.Descuentos.FirstOrDefaultAsync(d => d.Id == id && d.NegocioId == negocioId);
            if (descuento == null) return NotFound();

            descuento.Activo = false;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ── Público: validar código ───────────────────────────────────────────

        // GET /api/publico/descuentos/validar?codigo=xxx&slug=xxx
        [HttpGet("api/publico/descuentos/validar")]
        [EnableRateLimiting("PublicoGeneral")]
        public async Task<IActionResult> Validar([FromQuery] string codigo, [FromQuery] string slug)
        {
            if (string.IsNullOrWhiteSpace(codigo) || string.IsNullOrWhiteSpace(slug))
                return BadRequest();

            var negocio = await _db.Negocios.AsNoTracking()
                .FirstOrDefaultAsync(n => n.Slug == slug && n.Activo == 1);
            if (negocio is null)
                return NotFound(new { mensaje = "Negocio no encontrado" });

            var codigoNorm = codigo.Trim().ToUpper();
            var descuento = await _db.Descuentos.FirstOrDefaultAsync(d =>
                d.NegocioId == negocio.Id &&
                d.Codigo == codigoNorm &&
                d.Activo);

            if (descuento is null)
                return NotFound(new { mensaje = "Código de descuento inválido o expirado." });

            if (descuento.FechaExpiracion.HasValue && descuento.FechaExpiracion < DateTime.UtcNow)
                return BadRequest(new { mensaje = "Este código de descuento ha expirado." });

            if (descuento.UsoMaximo.HasValue && descuento.UsoActual >= descuento.UsoMaximo)
                return BadRequest(new { mensaje = "Este código ya alcanzó su límite de usos." });

            return Ok(new {
                descuento.Id,
                descuento.Codigo,
                descuento.Descripcion,
                descuento.Tipo,
                descuento.Valor,
            });
        }
    }

    public class DescuentoDto
    {
        [Required, MaxLength(50)]
        public string Codigo { get; set; } = string.Empty;

        [MaxLength(200)]
        public string? Descripcion { get; set; }

        [Required]
        public string Tipo { get; set; } = "Porcentaje";

        [Required, Range(0.01, 100000)]
        public decimal Valor { get; set; }

        [Range(1, int.MaxValue)]
        public int? UsoMaximo { get; set; }

        public DateTime? FechaExpiracion { get; set; }
    }
}
