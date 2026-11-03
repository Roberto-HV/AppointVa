using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Filters;
using AppointVaAPI.Helpers;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Admin;
using AppointVaAPI.Services;
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
        private readonly IAuditService _audit;
        private readonly IReautenticacionService _reautenticacion;

        public SuscripcionAdminController(
            ApplicationDbContext db,
            IBlobStorageService blob,
            ILogger<SuscripcionAdminController> logger,
            IAuditService audit,
            IReautenticacionService reautenticacion)
        {
            _reautenticacion = reautenticacion;
            _db = db;
            _blob = blob;
            _logger = logger;
            _audit = audit;
        }

        private static string Fecha(DateTime? fecha) => fecha?.ToString("yyyy-MM-dd") ?? "—";

        private static string Monto(decimal monto) => monto.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture);

        /// <summary>The step-up proof sent with this request (X-Reautenticacion) is valid for this admin.</summary>
        private Task<bool> PruebaValidaAsync() =>
            _reautenticacion.ValidarAsync(User, Request.Headers[ReautenticacionService.Encabezado].FirstOrDefault());

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
                    n.EsTester,
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
                var diasRestantes = FacturacionAdmin.DiasRestantes(n.FechaVencimiento, hoy);
                var estado = FacturacionAdmin.Estado(diasRestantes);
                var totalMensual = FacturacionAdmin.PrecioMensual(n.PrecioBase, n.EmpleadosExtra);

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
                    TotalMensual     = totalMensual,
                    PrecioEmpleadoExtra = FacturacionAdmin.PrecioEmpleadoExtra,
                    Sector          = n.Sector,
                    EsTester           = n.EsTester,
                    SuscripcionVigente = FacturacionAdmin.EsVigente(estado),
                    AccesoPermanente   = FacturacionAdmin.EsAccesoPermanente(diasRestantes),
                    IngresoMensual     = FacturacionAdmin.IngresoMensual(estado, diasRestantes, n.EsTester, totalMensual)
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

            var hoy = DateTime.UtcNow.Date;

            // Si ya hay vencimiento futuro, se extiende desde ahí; si no, desde hoy
            var periodoDesde = negocio.FechaVencimiento.HasValue && negocio.FechaVencimiento.Value.Date > hoy
                ? negocio.FechaVencimiento.Value.Date
                : hoy;

            var periodoHasta = periodoDesde.AddMonths(dto.MesesPagados).AddDays(-1);

            // Lote 5 (G1): reaching permanent access needs the step-up proof. Judged on the
            // RESULTING due date (payments stack), not on this payment alone; ordinary monthly
            // payments do not ask. The front prompts and retries on the 403.
            if (FacturacionAdmin.RequiereReautenticacion(dto.MesesPagados, negocio.FechaVencimiento, periodoHasta, hoy) &&
                !await PruebaValidaAsync())
                return RequiereReautenticacionAttribute.Rechazo();

            var adminId = Guid.Parse(User.FindFirstValue("sub")!);

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

            var vencimientoAntes = negocio.FechaVencimiento;
            negocio.FechaVencimiento    = periodoHasta;
            negocio.FechaActualizacion  = DateTime.UtcNow;

            // Mandatory audit in the same transaction: money records never change without a trace.
            await using var tx = await _db.Database.BeginTransactionAsync();
            _db.PagosSuscripcion.Add(pago);
            await _db.SaveChangesAsync();
            if (!await _audit.RegistrarNegocioObligatorioAsync(AccionesAuditoria.PagoRegistrado, id,
                    $"Pago #{numeroPago} ({pago.Id}); Monto: {Monto(pago.Monto)}; Meses: {pago.MesesPagados}; " +
                    $"Periodo: {Fecha(periodoDesde)} a {Fecha(periodoHasta)}; Vence: {Fecha(vencimientoAntes)} → {Fecha(periodoHasta)}"))
                return AuditoriaAdmin.NoDisponible(this);
            await tx.CommitAsync();

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

            var antes = $"Monto: {Monto(pago.Monto)}; Periodo: {Fecha(pago.PeriodoDesde)} a {Fecha(pago.PeriodoHasta)}";
            var notasCambiaron = (pago.Notas ?? "") != (dto.Notas?.Trim() ?? "");
            var vencimientoAntes = negocio.FechaVencimiento;

            // Recalculate vencimiento from all payments (other payments + the edited period)
            var otrosHasta = await _db.PagosSuscripcion
                .Where(p => p.NegocioId == negocio.Id && p.Id != pagoId)
                .Select(p => p.PeriodoHasta)
                .ToListAsync();
            var vencimientoNuevo = otrosHasta.Append(dto.PeriodoHasta.Date).Max();

            // Lote 5 (G1): editing the period can grant permanent access just like a payment can,
            // so the same rule applies, judged on the resulting due date before anything changes.
            if (FacturacionAdmin.RequiereReautenticacion(0, vencimientoAntes, vencimientoNuevo, DateTime.UtcNow.Date) &&
                !await PruebaValidaAsync())
                return RequiereReautenticacionAttribute.Rechazo();

            pago.Monto        = dto.Monto;
            pago.Notas        = dto.Notas?.Trim();
            pago.PeriodoDesde = dto.PeriodoDesde.Date;
            pago.PeriodoHasta = dto.PeriodoHasta.Date;

            negocio.FechaVencimiento   = vencimientoNuevo;
            negocio.FechaActualizacion = DateTime.UtcNow;

            await using (var tx = await _db.Database.BeginTransactionAsync())
            {
                await _db.SaveChangesAsync();
                // Notes are free text: only whether they changed is recorded.
                if (!await _audit.RegistrarNegocioObligatorioAsync(AccionesAuditoria.PagoEditado, negocio.Id,
                        $"Pago #{pago.NumeroPago} ({pago.Id}); Antes: {antes}; " +
                        $"Después: Monto: {Monto(pago.Monto)}; Periodo: {Fecha(pago.PeriodoDesde)} a {Fecha(pago.PeriodoHasta)}; " +
                        $"Notas cambiadas: {AuditoriaAdmin.SiNo(notasCambiaron)}; Vence: {Fecha(vencimientoAntes)} → {Fecha(negocio.FechaVencimiento)}"))
                    return AuditoriaAdmin.NoDisponible(this);
                await tx.CommitAsync();
            }

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

            var vencimientoAntes = negocio.FechaVencimiento;
            var resumen = $"Pago #{pago.NumeroPago} ({pago.Id}); Monto: {Monto(pago.Monto)}; Meses: {pago.MesesPagados}; " +
                          $"Periodo: {Fecha(pago.PeriodoDesde)} a {Fecha(pago.PeriodoHasta)}";

            await using var tx = await _db.Database.BeginTransactionAsync();
            _db.PagosSuscripcion.Remove(pago);
            await _db.SaveChangesAsync();

            var maxVencimiento = await _db.PagosSuscripcion
                .Where(p => p.NegocioId == negocio.Id)
                .MaxAsync(p => (DateTime?)p.PeriodoHasta);

            negocio.FechaVencimiento   = maxVencimiento;
            negocio.FechaActualizacion = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            if (!await _audit.RegistrarNegocioObligatorioAsync(AccionesAuditoria.PagoEliminado, negocio.Id,
                    $"{resumen}; Vence: {Fecha(vencimientoAntes)} → {Fecha(maxVencimiento)}"))
                return AuditoriaAdmin.NoDisponible(this);
            await tx.CommitAsync();

            return Ok();
        }

        // PATCH /api/admin/negocios/{id}/modulo-pagos
        // Toggle ModuloPagosHabilitado para un negocio
        [HttpPatch("negocios/{id:guid}/modulo-pagos")]
        public async Task<IActionResult> ToggleModuloPagos(Guid id, [FromBody] ToggleModuloPagosDto dto)
        {
            var negocio = await _db.Negocios.FindAsync(id);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            var antes = negocio.ModuloPagosHabilitado;
            negocio.ModuloPagosHabilitado = dto.Habilitado;
            negocio.FechaActualizacion = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            await _audit.RegistrarNegocioAsync(AccionesAuditoria.ModuloPagosCambiado, id,
                $"Habilitado: {AuditoriaAdmin.SiNo(antes)} → {AuditoriaAdmin.SiNo(negocio.ModuloPagosHabilitado)}");

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

            var antes = negocio.EmpleadosExtra;
            negocio.EmpleadosExtra = dto.EmpleadosExtra;
            negocio.FechaActualizacion = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            await _audit.RegistrarNegocioAsync(AccionesAuditoria.EmpleadosExtraCambiado, id,
                $"Empleados extra: {antes} → {negocio.EmpleadosExtra}");

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

            var antes = negocio.Sector;
            negocio.Sector = dto.Sector;
            negocio.FechaActualizacion = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            await _audit.RegistrarNegocioAsync(AccionesAuditoria.SectorCambiado, id,
                $"Sector: {antes} → {negocio.Sector}");
            return Ok();
        }

        // PATCH /api/admin/negocios/{id}/plan
        [HttpPatch("negocios/{id:guid}/plan")]
        public async Task<IActionResult> SetPlan(Guid id, [FromBody] SetPlanDto dto)
        {
            var negocio = await _db.Negocios.FindAsync(id);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            var planAntes = negocio.PlanId.HasValue
                ? await _db.Planes.Where(p => p.Id == negocio.PlanId.Value).Select(p => p.Nombre).FirstOrDefaultAsync()
                : null;
            var moduloAntes = negocio.ModuloPagosHabilitado;
            string? planDespues = null;

            if (dto.PlanId.HasValue)
            {
                var plan = await _db.Planes.FindAsync(dto.PlanId.Value);
                if (plan is null) return BadRequest(new { mensaje = "Plan no encontrado" });

                negocio.PlanId = dto.PlanId;
                negocio.ModuloPagosHabilitado = FacturacionAdmin.PlanHabilitaModuloPagos(plan.Nombre);
                planDespues = plan.Nombre;
            }
            else
            {
                negocio.PlanId = null;
                negocio.ModuloPagosHabilitado = false;
            }

            negocio.FechaActualizacion = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            await _audit.RegistrarNegocioAsync(AccionesAuditoria.PlanCambiado, id,
                $"Plan: {planAntes ?? "sin plan"} → {planDespues ?? "sin plan"}; " +
                $"Módulo de pagos: {AuditoriaAdmin.SiNo(moduloAntes)} → {AuditoriaAdmin.SiNo(negocio.ModuloPagosHabilitado)}");
            return Ok();
        }

        // POST /api/admin/negocios/{id}/tester[?esTester=true|false]
        // With ?esTester the value is set explicitly (idempotent: undo and retries cannot land
        // on the wrong state). Without it the current value is flipped, as before.
        // A request that changes nothing writes no audit row.
        [HttpPost("negocios/{id:guid}/tester")]
        public async Task<IActionResult> ToggleTester(Guid id, [FromQuery] bool? esTester = null)
        {
            var negocio = await _db.Negocios.FindAsync(id);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            var antes = negocio.EsTester;
            var despues = esTester ?? !antes;
            if (despues == antes) return Ok(new { esTester = negocio.EsTester });

            negocio.EsTester = despues;
            negocio.FechaActualizacion = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            await _audit.RegistrarNegocioAsync(AccionesAuditoria.TesterCambiado, id,
                $"Tester: {AuditoriaAdmin.SiNo(antes)} → {AuditoriaAdmin.SiNo(negocio.EsTester)}");

            return Ok(new { esTester = negocio.EsTester });
        }

        // GET /api/admin/negocios/{id}/impacto — lote 5 (I3)
        // What a hard delete would erase, counted the same way the delete removes it, so the
        // admin sees concrete figures (and the "deactivate instead" option) before confirming.
        [HttpGet("negocios/{id:guid}/impacto")]
        public async Task<IActionResult> ObtenerImpactoEliminacion(Guid id)
        {
            var negocio = await _db.Negocios.AsNoTracking().FirstOrDefaultAsync(n => n.Id == id);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            // Appointment times are the business's wall time, so "now" is too.
            var ahora = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ZonaHorariaHelper.Resolver(negocio.ZonaHoraria));
            var citasProximas = await _db.Citas.CountAsync(c => c.NegocioId == id && c.InicioEn >= ahora);
            var citasTotales = await _db.Citas.CountAsync(c => c.NegocioId == id);

            return Ok(new ImpactoEliminacionDto
            {
                NegocioId     = id,
                Activo        = negocio.Activo == 1,
                CitasProximas = citasProximas,
                CitasPasadas  = citasTotales - citasProximas,
                Clientes      = await _db.Clientes.IgnoreQueryFilters().CountAsync(c => c.NegocioId == id),
                Empleados     = await _db.Empleados.CountAsync(e => e.NegocioId == id),
                Servicios     = await _db.Servicios.CountAsync(s => s.NegocioId == id),
                Pagos         = await _db.PagosSuscripcion.CountAsync(p => p.NegocioId == id),
                Imagenes      = (await UrlsImagenesAsync(negocio)).Count,
                Resenas       = await _db.Resenas.CountAsync(r => r.NegocioId == id)
            });
        }

        /// <summary>Every stored image of the business and its children: what the delete removes from Cloudinary.</summary>
        private async Task<List<string>> UrlsImagenesAsync(Negocio negocio)
        {
            var id = negocio.Id;
            var urls = new List<string?> { negocio.LogoUrl, negocio.PortadaUrl };
            urls.AddRange(await _db.ImagenesNegocios.Where(i => i.NegocioId == id).Select(i => i.Url).ToListAsync());
            urls.AddRange(await _db.Empleados.Where(e => e.NegocioId == id).Select(e => e.FotoUrl).ToListAsync());
            urls.AddRange(await _db.Servicios.Where(s => s.NegocioId == id).Select(s => s.ImagenUrl).ToListAsync());
            return urls.Where(u => !string.IsNullOrWhiteSpace(u)).Select(u => u!).ToList();
        }

        // DELETE /api/admin/negocios/{id}
        // Hard delete — elimina imágenes en Cloudinary, luego el negocio con sus dependencias
        // en el orden correcto para evitar violaciones de FK (NoAction en varias relaciones).
        // Lote 5 (G1): needs the step-up proof (X-Reautenticacion), checked before anything runs.
        [HttpDelete("negocios/{id:guid}")]
        [RequiereReautenticacion]
        public async Task<IActionResult> EliminarNegocio(Guid id)
        {
            var negocio = await _db.Negocios.FindAsync(id);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            // Mandatory audit, written first and inside the transaction of the deletes: if it
            // cannot be written nothing is touched; if a delete fails, the rollback takes the
            // entry with it and images and jobs are still intact (they are removed after commit). The name goes in the detail because the
            // business row will no longer exist to resolve it.
            await using var tx = await _db.Database.BeginTransactionAsync();
            var citas = await _db.Citas.CountAsync(c => c.NegocioId == id);
            var clientes = await _db.Clientes.IgnoreQueryFilters().CountAsync(c => c.NegocioId == id);
            var pagos = await _db.PagosSuscripcion.CountAsync(p => p.NegocioId == id);
            if (!await _audit.RegistrarNegocioObligatorioAsync(AccionesAuditoria.NegocioEliminado, id,
                    $"Nombre: {negocio.Nombre}; Slug: {negocio.Slug}; Citas: {citas}; Clientes: {clientes}; Pagos: {pagos}"))
                return AuditoriaAdmin.NoDisponible(this);

            // Recopilar todas las URLs de imágenes del negocio y sus entidades hijo
            var urlsValidas = await UrlsImagenesAsync(negocio);

            // Los jobs de Hangfire de las citas se leen ahora (las citas se borran abajo)
            // y se cancelan después del commit, junto con las imágenes.
            var jobIds = await _db.Citas
                .Where(c => c.NegocioId == id && c.HangfireJobId != null)
                .Select(c => c.HangfireJobId!)
                .ToListAsync();

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
            await tx.CommitAsync();

            // Efectos externos irreversibles solo cuando el borrado y su registro ya están
            // confirmados: si algo de arriba falla, el negocio sigue intacto con sus
            // imágenes y recordatorios. Un fallo aquí deja, a lo sumo, archivos huérfanos.
            foreach (var jobId in jobIds)
            {
                try { BackgroundJob.Delete(jobId); }
                catch (Exception ex) { _logger.LogWarning(ex, "No se pudo cancelar el job {JobId}", jobId); }
            }

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
                "Negocio {NegocioId}: {Eliminadas}/{Total} imágenes eliminadas de Cloudinary después del delete.",
                id, eliminadas, urlsValidas.Count);

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
