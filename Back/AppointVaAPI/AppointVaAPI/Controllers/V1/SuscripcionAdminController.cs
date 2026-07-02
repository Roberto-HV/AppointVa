using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    [Route("api/admin")]
    [Authorize(Roles = Roles.SuperAdmin)]
    public class SuscripcionAdminController : ControllerBase
    {
        private readonly ApplicationDbContext _db;

        public SuscripcionAdminController(ApplicationDbContext db)
        {
            _db = db;
        }

        // GET /api/admin/suscripciones
        // Resumen de todos los negocios con estado de suscripción
        [HttpGet("suscripciones")]
        public async Task<IActionResult> ObtenerSuscripciones()
        {
            var hoy = DateTime.UtcNow.Date;

            var negocios = await _db.Negocios
                .Where(n => n.Activo == 1)
                .OrderBy(n => n.Nombre)
                .Select(n => new
                {
                    n.Id,
                    n.Nombre,
                    n.Slug,
                    n.FechaVencimiento
                })
                .ToListAsync();

            var negocioIds = negocios.Select(n => n.Id).ToList();

            var conteosPagos = await _db.PagosSuscripcion
                .Where(p => negocioIds.Contains(p.NegocioId))
                .GroupBy(p => p.NegocioId)
                .Select(g => new { NegocioId = g.Key, Total = g.Count() })
                .ToListAsync();

            var ultimosPagos = await _db.PagosSuscripcion
                .Include(p => p.RegistradoPor)
                .Include(p => p.Negocio)
                .Where(p => negocioIds.Contains(p.NegocioId))
                .GroupBy(p => p.NegocioId)
                .Select(g => g.OrderByDescending(p => p.FechaPago).First())
                .ToListAsync();

            var resultado = negocios.Select(n =>
            {
                int? diasRestantes = n.FechaVencimiento.HasValue
                    ? (int?)(n.FechaVencimiento.Value.Date - hoy).TotalDays
                    : null;

                string estado = diasRestantes switch
                {
                    null => "SinSuscripcion",
                    > 7  => "Activa",
                    >= 0 => "PorVencer",
                    _    => "Vencida"
                };

                var ultimoPago = ultimosPagos.FirstOrDefault(p => p.NegocioId == n.Id);
                var totalPagos = conteosPagos.FirstOrDefault(c => c.NegocioId == n.Id)?.Total ?? 0;

                return new SuscripcionResumenDto
                {
                    NegocioId      = n.Id,
                    NegocioNombre  = n.Nombre,
                    NegocioSlug    = n.Slug,
                    FechaVencimiento = n.FechaVencimiento,
                    Estado         = estado,
                    DiasRestantes  = diasRestantes,
                    TotalPagos     = totalPagos,
                    UltimoPago     = ultimoPago == null ? null : MapPago(ultimoPago)
                };
            }).ToList();

            return Ok(resultado);
        }

        // POST /api/admin/negocios/{id}/pagos
        // Registrar un pago de suscripción
        [HttpPost("negocios/{id:guid}/pagos")]
        public async Task<IActionResult> RegistrarPago(Guid id, [FromBody] RegistrarPagoDto dto)
        {
            var negocio = await _db.Negocios.FindAsync(id);
            if (negocio == null) return NotFound();

            var adminId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var hoy = DateTime.UtcNow.Date;

            // Si ya hay vencimiento futuro, se extiende desde ahí; si no, desde hoy
            var periodoDesde = negocio.FechaVencimiento.HasValue && negocio.FechaVencimiento.Value.Date > hoy
                ? negocio.FechaVencimiento.Value.Date
                : hoy;

            var periodoHasta = periodoDesde.AddMonths(dto.MesesPagados).AddDays(-1);

            var numeroPago = await _db.PagosSuscripcion.CountAsync(p => p.NegocioId == id) + 1;

            var pago = new PagoSuscripcion
            {
                Id              = Guid.NewGuid(),
                NegocioId       = id,
                RegistradoPorId = adminId,
                FechaPago       = DateTime.UtcNow,
                PeriodoDesde    = periodoDesde,
                PeriodoHasta    = periodoHasta,
                MesesPagados    = dto.MesesPagados,
                Monto           = dto.Monto,
                Notas           = dto.Notas?.Trim(),
                NumeroPago      = numeroPago
            };

            negocio.FechaVencimiento    = periodoHasta;
            negocio.FechaActualizacion  = DateTime.UtcNow;

            _db.PagosSuscripcion.Add(pago);
            await _db.SaveChangesAsync();

            // Cargar relaciones para el DTO de respuesta
            await _db.Entry(pago).Reference(p => p.RegistradoPor).LoadAsync();
            await _db.Entry(pago).Reference(p => p.Negocio).LoadAsync();

            return Ok(MapPago(pago));
        }

        // GET /api/admin/negocios/{id}/pagos
        // Historial de pagos de un negocio
        [HttpGet("negocios/{id:guid}/pagos")]
        public async Task<IActionResult> ObtenerPagos(Guid id)
        {
            var negocio = await _db.Negocios.FindAsync(id);
            if (negocio == null) return NotFound();

            var pagos = await _db.PagosSuscripcion
                .Include(p => p.RegistradoPor)
                .Include(p => p.Negocio)
                .Where(p => p.NegocioId == id)
                .OrderByDescending(p => p.FechaPago)
                .Select(p => MapPago(p))
                .ToListAsync();

            return Ok(pagos);
        }

        // GET /api/admin/pagos/{pagoId}
        // Datos de un pago individual (para comprobante)
        [HttpGet("pagos/{pagoId:guid}")]
        public async Task<IActionResult> ObtenerPago(Guid pagoId)
        {
            var pago = await _db.PagosSuscripcion
                .Include(p => p.RegistradoPor)
                .Include(p => p.Negocio)
                .FirstOrDefaultAsync(p => p.Id == pagoId);

            if (pago == null) return NotFound();

            return Ok(MapPago(pago));
        }

        private static PagoSuscripcionDto MapPago(PagoSuscripcion p) => new()
        {
            Id                 = p.Id,
            NegocioId          = p.NegocioId,
            NegocioNombre      = p.Negocio?.Nombre ?? string.Empty,
            RegistradoPorEmail = p.RegistradoPor?.Email ?? string.Empty,
            FechaPago          = p.FechaPago,
            PeriodoDesde       = p.PeriodoDesde,
            PeriodoHasta       = p.PeriodoHasta,
            MesesPagados       = p.MesesPagados,
            Monto              = p.Monto,
            Notas              = p.Notas,
            NumeroPago         = p.NumeroPago
        };
    }
}
