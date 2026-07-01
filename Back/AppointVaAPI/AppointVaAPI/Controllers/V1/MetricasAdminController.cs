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
                CitasMes = _db.Citas.Count(c => c.NegocioId == n.Id && c.InicioEn >= inicioMes),
                EmpleadosActivos = _db.Empleados.Count(e => e.NegocioId == n.Id && e.FechaEliminacion == null && e.Activo == 1),
                EmailsMes = _db.EmailLogs.Count(e => e.NegocioId == n.Id && e.EnviadoEn >= inicioMes)
            }).ToList();

            return Ok(result);
        }
    }
}
