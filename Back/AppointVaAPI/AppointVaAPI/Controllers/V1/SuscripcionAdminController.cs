using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Admin;
using AppointVaAPI.Services.IServices;
using Hangfire;
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
        private readonly IBlobStorageService _blob;
        private readonly ILogger<SuscripcionAdminController> _logger;

        public SuscripcionAdminController(
            ApplicationDbContext db,
            IBlobStorageService blob,
            ILogger<SuscripcionAdminController> logger)
        {
            _db = db;
            _blob = blob;
            _logger = logger;
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
                    n.FechaVencimiento,
                    n.EmpleadosExtra,
                    n.Sector,
                    PlanNombre = n.Plan != null ? n.Plan.Nombre : null,
                    PrecioBase = n.Plan != null ? n.Plan.PrecioMensual : 0m,
                    MaxEmpleadosBase = n.Plan != null ? n.Plan.MaxEmpleados : 0
                })
                .ToListAsync();

            var negocioIds = negocios.Select(n => n.Id).ToList();

            var conteosPagos = await _db.PagosSuscripcion
                .Where(p => negocioIds.Contains(p.NegocioId))
                .GroupBy(p => p.NegocioId)
                .Select(g => new { NegocioId = g.Key, Total = g.Count() })
                .ToListAsync();

            var todosPagos = await _db.PagosSuscripcion
                .Include(p => p.RegistradoPor)
                .Include(p => p.Negocio)
                .Where(p => negocioIds.Contains(p.NegocioId))
                .OrderByDescending(p => p.FechaPago)
                .ToListAsync();

            var ultimosPagos = todosPagos
                .GroupBy(p => p.NegocioId)
                .Select(g => g.First())
                .ToList();

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
                    NegocioId        = n.Id,
                    NegocioNombre    = n.Nombre,
                    NegocioSlug      = n.Slug,
                    FechaVencimiento = n.FechaVencimiento,
                    Estado           = estado,
                    DiasRestantes    = diasRestantes,
                    TotalPagos       = totalPagos,
                    UltimoPago       = ultimoPago == null ? null : MapPago(ultimoPago),
                    PlanNombre       = n.PlanNombre,
                    PrecioBase       = n.PrecioBase,
                    MaxEmpleadosBase = n.MaxEmpleadosBase,
                    EmpleadosExtra   = n.EmpleadosExtra,
                    TotalMensual     = n.PrecioBase + (n.EmpleadosExtra * 50m),
                    Sector           = n.Sector
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

            var adminId = Guid.Parse(User.FindFirstValue("sub")!);

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

            var pagos = (await _db.PagosSuscripcion
                .Include(p => p.RegistradoPor)
                .Include(p => p.Negocio)
                .Where(p => p.NegocioId == id)
                .OrderByDescending(p => p.FechaPago)
                .ToListAsync())
                .Select(MapPago)
                .ToList();

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

        // PATCH /api/admin/pagos/{pagoId}
        [HttpPatch("pagos/{pagoId:guid}")]
        public async Task<IActionResult> EditarPago(Guid pagoId, [FromBody] EditarPagoDto dto)
        {
            var pago = await _db.PagosSuscripcion.FirstOrDefaultAsync(p => p.Id == pagoId);
            if (pago is null) return NotFound(new { mensaje = "Pago no encontrado" });

            var negocio = await _db.Negocios.FindAsync(pago.NegocioId);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            pago.Monto        = dto.Monto;
            pago.Notas        = dto.Notas?.Trim();
            pago.PeriodoDesde = dto.PeriodoDesde.Date;
            pago.PeriodoHasta = dto.PeriodoHasta.Date;

            // Recalculate vencimiento from all payments (other payments + updated one in memory)
            var otrosHasta = await _db.PagosSuscripcion
                .Where(p => p.NegocioId == negocio.Id && p.Id != pagoId)
                .Select(p => (DateTime?)p.PeriodoHasta)
                .ToListAsync();

            var todasHasta = otrosHasta.Append((DateTime?)pago.PeriodoHasta).Where(d => d.HasValue).Select(d => d!.Value);
            negocio.FechaVencimiento   = todasHasta.Any() ? todasHasta.Max() : null;
            negocio.FechaActualizacion = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            await _db.Entry(pago).Reference(p => p.RegistradoPor).LoadAsync();
            await _db.Entry(pago).Reference(p => p.Negocio).LoadAsync();

            return Ok(MapPago(pago));
        }

        // DELETE /api/admin/pagos/{pagoId}
        [HttpDelete("pagos/{pagoId:guid}")]
        public async Task<IActionResult> EliminarPago(Guid pagoId)
        {
            var pago = await _db.PagosSuscripcion.FirstOrDefaultAsync(p => p.Id == pagoId);
            if (pago is null) return NotFound(new { mensaje = "Pago no encontrado" });

            var negocio = await _db.Negocios.FindAsync(pago.NegocioId);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            _db.PagosSuscripcion.Remove(pago);
            await _db.SaveChangesAsync();

            var maxVencimiento = await _db.PagosSuscripcion
                .Where(p => p.NegocioId == negocio.Id)
                .MaxAsync(p => (DateTime?)p.PeriodoHasta);

            negocio.FechaVencimiento   = maxVencimiento;
            negocio.FechaActualizacion = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return Ok();
        }

        // PATCH /api/admin/negocios/{id}/modulo-pagos
        // Toggle ModuloPagosHabilitado para un negocio
        [HttpPatch("negocios/{id:guid}/modulo-pagos")]
        public async Task<IActionResult> ToggleModuloPagos(Guid id, [FromBody] ToggleModuloPagosDto dto)
        {
            var negocio = await _db.Negocios.FindAsync(id);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            negocio.ModuloPagosHabilitado = dto.Habilitado;
            negocio.FechaActualizacion = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return Ok(new { negocioId = id, moduloPagosHabilitado = negocio.ModuloPagosHabilitado });
        }

        // PATCH /api/admin/negocios/{id}/empleados-extra
        // Actualizar cantidad de empleados extra para un negocio
        [HttpPatch("negocios/{id:guid}/empleados-extra")]
        public async Task<IActionResult> SetEmpleadosExtra(Guid id, [FromBody] SetEmpleadosExtraDto dto)
        {
            if (dto.EmpleadosExtra < 0)
                return BadRequest("EmpleadosExtra no puede ser negativo.");

            var negocio = await _db.Negocios
                .FirstOrDefaultAsync(n => n.Id == id && n.Activo == 1);

            if (negocio == null) return NotFound();

            negocio.EmpleadosExtra = dto.EmpleadosExtra;
            negocio.FechaActualizacion = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return Ok();
        }

        // PATCH /api/admin/negocios/{id}/sector
        // Actualizar sector para un negocio
        [HttpPatch("negocios/{id:guid}/sector")]
        public async Task<IActionResult> SetSector(Guid id, [FromBody] SetSectorDto dto)
        {
            string[] sectoresValidos = ["belleza", "salud"];
            if (!sectoresValidos.Contains(dto.Sector))
                return BadRequest("Sector inválido. Valores permitidos: belleza, salud.");

            var negocio = await _db.Negocios.FindAsync(id);
            if (negocio == null) return NotFound();

            negocio.Sector = dto.Sector;
            negocio.FechaActualizacion = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok();
        }

        // PATCH /api/admin/negocios/{id}/plan
        [HttpPatch("negocios/{id:guid}/plan")]
        public async Task<IActionResult> SetPlan(Guid id, [FromBody] SetPlanDto dto)
        {
            var negocio = await _db.Negocios.FindAsync(id);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            if (dto.PlanId.HasValue)
            {
                var plan = await _db.Planes.FindAsync(dto.PlanId.Value);
                if (plan is null) return BadRequest(new { mensaje = "Plan no encontrado" });

                negocio.PlanId = dto.PlanId;
                negocio.ModuloPagosHabilitado = plan.Nombre.Contains("Pro", StringComparison.OrdinalIgnoreCase);
            }
            else
            {
                negocio.PlanId = null;
                negocio.ModuloPagosHabilitado = false;
            }

            negocio.FechaActualizacion = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok();
        }

        // POST /api/admin/negocios/{id}/tester
        // Toggle EsTester para un negocio
        [HttpPost("negocios/{id:guid}/tester")]
        public async Task<IActionResult> ToggleTester(Guid id)
        {
            var negocio = await _db.Negocios.FindAsync(id);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            negocio.EsTester = !negocio.EsTester;
            negocio.FechaActualizacion = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return Ok(new { esTester = negocio.EsTester });
        }

        // DELETE /api/admin/negocios/{id}
        // Hard delete — elimina imágenes en Cloudinary, luego el negocio con sus dependencias
        // en el orden correcto para evitar violaciones de FK (NoAction en varias relaciones).
        [HttpDelete("negocios/{id:guid}")]
        public async Task<IActionResult> EliminarNegocio(Guid id)
        {
            var negocio = await _db.Negocios.FindAsync(id);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            // Recopilar todas las URLs de imágenes del negocio y sus entidades hijo
            var urls = new List<string?>();

            urls.Add(negocio.LogoUrl);
            urls.Add(negocio.PortadaUrl);

            var imagenesGaleria = await _db.ImagenesNegocios
                .Where(i => i.NegocioId == id)
                .Select(i => i.Url)
                .ToListAsync();
            urls.AddRange(imagenesGaleria);

            var fotosEmpleados = await _db.Empleados
                .Where(e => e.NegocioId == id)
                .Select(e => e.FotoUrl)
                .ToListAsync();
            urls.AddRange(fotosEmpleados);

            var imagenesServicios = await _db.Servicios
                .Where(s => s.NegocioId == id)
                .Select(s => s.ImagenUrl)
                .ToListAsync();
            urls.AddRange(imagenesServicios);

            // Eliminar imágenes de Cloudinary (o local) — errores individuales no bloquean el delete
            var urlsValidas = urls.Where(u => !string.IsNullOrWhiteSpace(u)).Select(u => u!).ToList();
            int eliminadas = 0;

            foreach (var url in urlsValidas)
            {
                try
                {
                    var ok = await _blob.EliminarImagenAsync(url);
                    if (ok) eliminadas++;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "No se pudo eliminar imagen de Cloudinary: {Url}", url);
                }
            }

            _logger.LogInformation(
                "Negocio {NegocioId}: {Eliminadas}/{Total} imágenes eliminadas de Cloudinary antes del delete.",
                id, eliminadas, urlsValidas.Count);

            // ── Cancelar Hangfire jobs pendientes de citas ───────────────────────────
            var jobIds = await _db.Citas
                .Where(c => c.NegocioId == id && c.HangfireJobId != null)
                .Select(c => c.HangfireJobId!)
                .ToListAsync();
            foreach (var jobId in jobIds)
                BackgroundJob.Delete(jobId);

            // ── Eliminaciones explícitas en orden (hijos antes que padres) ───────────
            // Las relaciones con OnDelete(NoAction) bloquean el DELETE del negocio;
            // las Cascade las deja el motor de BD, pero algunas deben ir antes
            // porque tienen NoAction hacia otras entidades que eliminamos explícitamente.

            // 1. RespuestasIntake → Cita (Cascade en BD, pero Cita aún no se ha eliminado)
            await _db.RespuestasIntake
                .Where(ri => _db.Citas.Where(c => c.NegocioId == id).Select(c => c.Id).Contains(ri.CitaId))
                .ExecuteDeleteAsync();

            // 2. Resenas → Cita (NoAction) — eliminar antes que Citas para evitar FK violation
            await _db.Resenas.Where(r => r.NegocioId == id).ExecuteDeleteAsync();

            // 3. Citas → Negocio (Cascade), pero → Cliente/Empleado/Servicio (NoAction)
            //    Las eliminamos explícitamente para poder borrar esas entidades después
            await _db.Citas.Where(c => c.NegocioId == id).ExecuteDeleteAsync();

            // 4. ListaEspera → Servicio y Empleado (NoAction) — antes que esas entidades
            await _db.ListaEspera.Where(le => le.NegocioId == id).ExecuteDeleteAsync();

            // 5. CampoIntakeServicio → CampoIntake (Cascade) — antes que CamposIntake
            await _db.CampoIntakeServicios
                .Where(cis => _db.CamposIntake.Where(ci => ci.NegocioId == id).Select(ci => ci.Id).Contains(cis.CampoIntakeId))
                .ExecuteDeleteAsync();

            // 6. CamposIntake → Servicio (NoAction) — antes que Servicios
            await _db.CamposIntake.Where(ci => ci.NegocioId == id).ExecuteDeleteAsync();

            // 7. EmpleadoServicio → Empleado y Servicio (Cascade) — antes que ambos
            await _db.EmpleadosServicios
                .Where(es => _db.Servicios.Where(s => s.NegocioId == id).Select(s => s.Id).Contains(es.ServicioId))
                .ExecuteDeleteAsync();

            // 8. Clientes → Negocio (NoAction); IgnoreQueryFilters para incluir soft-deleted
            await _db.Clientes.IgnoreQueryFilters().Where(c => c.NegocioId == id).ExecuteDeleteAsync();

            // 9. Empleados → Negocio (NoAction); BD cascade elimina HorarioEmpleado y BloqueoHorario
            await _db.Empleados.Where(e => e.NegocioId == id).ExecuteDeleteAsync();

            // 10. Servicios → Negocio (NoAction)
            await _db.Servicios.Where(s => s.NegocioId == id).ExecuteDeleteAsync();

            // 11. CategoriasServicios → Negocio (NoAction)
            await _db.CategoriasServicios.Where(cs => cs.NegocioId == id).ExecuteDeleteAsync();

            // 12. Desvincula usuarios — NegocioId = null; no se eliminan para conservar historial
            await _db.Users
                .Where(u => u.NegocioId == id)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.NegocioId, (Guid?)null));

            // 13. Eliminar el negocio — BD CASCADE elimina automáticamente:
            //     HorarioNegocio, BloqueoNegocio, ImagenesNegocios, Descuentos, EmailLogs,
            //     PagosSuscripcion, CierresCaja, NotificacionesDashboard, EncuestasNegocio
            _db.Negocios.Remove(negocio);
            await _db.SaveChangesAsync();

            return NoContent();
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
