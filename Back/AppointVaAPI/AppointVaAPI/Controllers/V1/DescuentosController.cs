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

        // GET /api/descuentos?incluirInactivos=true
        // B14: with incluirInactivos the deactivated coupons are listed too, so the
        // owner can reactivate them.
        [HttpGet("api/descuentos")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
        public async Task<IActionResult> GetDescuentos([FromQuery] bool incluirInactivos = false)
        {
            var negocioId = _contexto.NegocioId;
            if (negocioId == null) return Unauthorized();

            var descuentos = await _db.Descuentos
                .Where(d => d.NegocioId == negocioId && (incluirInactivos || d.Activo))
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

            var error = ValidarReglas(dto);
            if (error != null) return BadRequest(new { mensaje = error });

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

        // PUT /api/descuentos/{id}
        // B16: edits code, description, type, value, limit and expiry with the
        // create rules. UsoActual is kept: past uses still count against the new
        // limit, so the limit cannot go below the uses already made. Bookings that
        // already used the coupon keep the price they were charged (Cita.Precio is
        // stored at booking time). Editing does not change Activo.
        [HttpPut("api/descuentos/{id:guid}")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
        public async Task<IActionResult> Actualizar(Guid id, [FromBody] DescuentoDto dto)
        {
            var negocioId = _contexto.NegocioId;
            if (negocioId == null) return Unauthorized();

            var descuento = await _db.Descuentos.FirstOrDefaultAsync(d => d.Id == id && d.NegocioId == negocioId);
            if (descuento == null) return NotFound();

            var error = ValidarReglas(dto);
            if (error != null) return BadRequest(new { mensaje = error });

            if (dto.UsoMaximo.HasValue && dto.UsoMaximo.Value < descuento.UsoActual)
                return BadRequest(new { mensaje = $"El límite no puede ser menor a los {descuento.UsoActual} usos que ya tiene." });

            var codigoNorm = dto.Codigo.Trim().ToUpper();
            if (descuento.Activo && await ExisteOtroActivoAsync(negocioId.Value, codigoNorm, id))
                return BadRequest(new { mensaje = "Ya existe un descuento activo con ese código." });

            descuento.Codigo = codigoNorm;
            descuento.Descripcion = dto.Descripcion?.Trim();
            descuento.Tipo = dto.Tipo;
            descuento.Valor = dto.Valor;
            descuento.UsoMaximo = dto.UsoMaximo;
            descuento.FechaExpiracion = dto.FechaExpiracion;
            await _db.SaveChangesAsync();
            return Ok(Mapear(descuento));
        }

        // PATCH /api/descuentos/{id}/reactivar
        // B14: undoes DELETE. Refused while another active coupon uses the same code.
        [HttpPatch("api/descuentos/{id:guid}/reactivar")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
        public async Task<IActionResult> Reactivar(Guid id)
        {
            var negocioId = _contexto.NegocioId;
            if (negocioId == null) return Unauthorized();

            var descuento = await _db.Descuentos.FirstOrDefaultAsync(d => d.Id == id && d.NegocioId == negocioId);
            if (descuento == null) return NotFound();

            if (!descuento.Activo)
            {
                if (await ExisteOtroActivoAsync(negocioId.Value, descuento.Codigo, id))
                    return Conflict(new { mensaje = "Ya hay otro cupón activo con ese código. Desactívalo o cambia el código antes de reactivar este." });
                descuento.Activo = true;
                await _db.SaveChangesAsync();
            }
            return Ok(Mapear(descuento));
        }

        private Task<bool> ExisteOtroActivoAsync(Guid negocioId, string codigo, Guid excluirId) =>
            _db.Descuentos.AnyAsync(d =>
                d.NegocioId == negocioId && d.Codigo == codigo && d.Activo && d.Id != excluirId);

        /// <summary>Rules shared by create and edit. Returns the error message or null.</summary>
        private static string? ValidarReglas(DescuentoDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Codigo))
                return "El código es obligatorio.";
            if (dto.Codigo.Trim().Any(char.IsWhiteSpace))
                return "El código no puede llevar espacios.";
            if (dto.Tipo is not ("Porcentaje" or "MontoFijo"))
                return "El tipo debe ser Porcentaje o MontoFijo.";
            if (dto.Tipo == "Porcentaje" && dto.Valor > 100)
                return "Un porcentaje no puede pasar de 100%.";
            return null;
        }

        private static object Mapear(Descuento d) => new
        {
            d.Id, d.Codigo, d.Descripcion, d.Tipo, d.Valor,
            d.UsoMaximo, d.UsoActual, d.FechaExpiracion, d.Activo,
            agotado = d.UsoMaximo.HasValue && d.UsoActual >= d.UsoMaximo,
            expirado = d.FechaExpiracion.HasValue && d.FechaExpiracion < DateTime.UtcNow,
        };

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
