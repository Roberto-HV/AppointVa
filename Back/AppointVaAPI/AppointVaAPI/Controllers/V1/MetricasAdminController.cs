using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models.Dtos.Negocios;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    [Route("api/admin/metricas")]
    [Authorize(Roles = Roles.SuperAdmin)]
    public class MetricasAdminController : ControllerBase
    {
        private readonly ApplicationDbContext _db;

        public MetricasAdminController(ApplicationDbContext db)
        {
            _db = db;
        }

        // GET /api/admin/metricas/negocios
        [HttpGet("negocios")]
        public async Task<IActionResult> ObtenerMetricasNegocios()
        {
            var ahora = DateTime.UtcNow;
            var inicioMes = new DateTime(ahora.Year, ahora.Month, 1, 0, 0, 0, DateTimeKind.Utc);

            var negocios = await _db.Negocios
                .Where(n => n.FechaEliminacion == null)
                .Include(n => n.Plan)
                .OrderBy(n => n.Nombre)
                .ToListAsync();

            var ids = negocios.Select(n => n.Id).ToList();

            // Batch queries — evita N+1 queries individuales por negocio
            var citasPorNegocio = await _db.Citas
                .Where(c => ids.Contains(c.NegocioId) && c.InicioEn >= inicioMes)
                .GroupBy(c => c.NegocioId)
                .Select(g => new { NegocioId = g.Key, Total = g.Count() })
                .ToDictionaryAsync(x => x.NegocioId, x => x.Total);

            var empleadosPorNegocio = await _db.Empleados
                .Where(e => ids.Contains(e.NegocioId) && e.FechaEliminacion == null && e.Activo == 1)
                .GroupBy(e => e.NegocioId)
                .Select(g => new { NegocioId = g.Key, Total = g.Count() })
                .ToDictionaryAsync(x => x.NegocioId, x => x.Total);

            var emailsPorNegocio = await _db.EmailLogs
                .Where(e => ids.Contains(e.NegocioId) && e.EnviadoEn >= inicioMes)
                .GroupBy(e => e.NegocioId)
                .Select(g => new { NegocioId = g.Key, Total = g.Count() })
                .ToDictionaryAsync(x => x.NegocioId, x => x.Total);

            var result = negocios.Select(n => new NegocioMetricasDto
            {
                Id = n.Id,
                Nombre = n.Nombre,
                Slug = n.Slug,
                Activo = n.Activo,
                LogoUrl = n.LogoUrl,
                Email = n.Email,
                ColorPrimario = n.ColorPrimario,
                ColorSecundario = n.ColorSecundario,
                PlanNombre = n.Plan?.Nombre,
                PlanId = n.PlanId,
                MaxCitasMes = n.Plan?.MaxCitasMes ?? 0,
                MaxEmpleados = n.Plan?.MaxEmpleados ?? 0,
                CitasMes = citasPorNegocio.GetValueOrDefault(n.Id, 0),
                EmpleadosActivos = empleadosPorNegocio.GetValueOrDefault(n.Id, 0),
                EmailsMes = emailsPorNegocio.GetValueOrDefault(n.Id, 0)
            }).ToList();

            return Ok(result);
        }
    }
}
