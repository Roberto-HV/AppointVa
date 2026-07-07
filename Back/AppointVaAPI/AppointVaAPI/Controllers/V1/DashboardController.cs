using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models.Dtos.Dashboard;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    [Route("api/dashboard")]
    [Authorize(Roles = $"{Roles.Propietario},{Roles.Empleado}")]
    public class DashboardController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IContextoNegocio _contexto;

        public DashboardController(ApplicationDbContext db, IContextoNegocio contexto)
        {
            _db = db;
            _contexto = contexto;
        }

        // GET api/dashboard/resumen
        [HttpGet("resumen")]
        public async Task<IActionResult> ObtenerResumen()
        {
            if (_contexto.NegocioId is null) return Unauthorized();
            var negocioId = _contexto.NegocioId.Value;

            var ahora = DateTime.UtcNow;
            var hoyInicio = ahora.Date;
            var hoyFin = hoyInicio.AddDays(1);
            var diaSemana = (int)hoyInicio.DayOfWeek;
            var inicioSemana = hoyInicio.AddDays(diaSemana == 0 ? -6 : -(diaSemana - 1));
            var inicioMes = new DateTime(hoyInicio.Year, hoyInicio.Month, 1, 0, 0, 0, DateTimeKind.Utc);

            var base_ = _db.Citas.Where(c => c.NegocioId == negocioId);

            // Conteos — SQL COUNT
            var citasHoy     = await base_.CountAsync(c => c.InicioEn >= hoyInicio && c.InicioEn < hoyFin);
            var citasSemana  = await base_.CountAsync(c => c.InicioEn >= inicioSemana);
            var citasMes     = await base_.CountAsync(c => c.InicioEn >= inicioMes);

            // Ingresos — SQL SUM sobre completadas
            var completadasBase = base_.Where(c => c.Estado == EstadosCitas.Completada);
            var ingresosHoy    = await completadasBase.Where(c => c.InicioEn >= hoyInicio && c.InicioEn < hoyFin).SumAsync(c => c.Precio);
            var ingresosSemana = await completadasBase.Where(c => c.InicioEn >= inicioSemana).SumAsync(c => c.Precio);
            var ingresosMes    = await completadasBase.Where(c => c.InicioEn >= inicioMes).SumAsync(c => c.Precio);

            // Próximas 5 citas — carga mínima con proyección
            var proximas = await base_
                .Where(c => c.InicioEn >= ahora &&
                            (c.Estado == EstadosCitas.Pendiente || c.Estado == EstadosCitas.Confirmada))
                .OrderBy(c => c.InicioEn)
                .Take(5)
                .Select(c => new CitaResumenDto
                {
                    Id = c.Id,
                    CodigoConfirmacion = c.CodigoConfirmacion,
                    NombreCliente  = c.Cliente != null ? c.Cliente.NombreCompleto : string.Empty,
                    NombreServicio = c.Servicio != null ? c.Servicio.Nombre : string.Empty,
                    NombreEmpleado = c.Empleado != null ? c.Empleado.Nombre : string.Empty,
                    InicioEn   = c.InicioEn,
                    Estado     = c.Estado,
                    EstadoTexto = PublicoController.ObtenerEstadoTexto(c.Estado)
                })
                .ToListAsync();

            // Top 5 servicios — GROUP BY en SQL
            var topServicios = await base_
                .Where(c => c.InicioEn >= inicioMes && c.Servicio != null)
                .GroupBy(c => c.Servicio!.Nombre)
                .Select(g => new ServicioPopularDto { Nombre = g.Key, TotalCitas = g.Count() })
                .OrderByDescending(s => s.TotalCitas)
                .Take(5)
                .ToListAsync();

            return Ok(new ResumenDashboardDto
            {
                CitasHoy      = citasHoy,
                CitasSemana   = citasSemana,
                CitasMes      = citasMes,
                IngresosHoy   = ingresosHoy,
                IngresosSemana = ingresosSemana,
                IngresosMes   = ingresosMes,
                ProximasCitas = proximas,
                TopServicios  = topServicios
            });
        }

        // GET api/dashboard/tendencia?dias=14
        [HttpGet("tendencia")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> ObtenerTendencia([FromQuery] int dias = 14)
        {
            if (_contexto.NegocioId is null) return Unauthorized();
            var negocioId = _contexto.NegocioId.Value;

            dias = Math.Clamp(dias, 1, 90);
            var hoyUtc = DateTime.UtcNow.Date;
            var inicio = hoyUtc.AddDays(-(dias - 1));

            var citas = await _db.Citas
                .Where(c => c.NegocioId == negocioId &&
                            c.InicioEn >= inicio &&
                            c.InicioEn < hoyUtc.AddDays(1))
                .Select(c => new { c.InicioEn, c.Estado, c.Precio })
                .ToListAsync();

            var cultura = new CultureInfo("es-MX");
            var datos = Enumerable.Range(0, dias).Select(i =>
            {
                var fecha = inicio.AddDays(i);
                var delDia = citas.Where(c => c.InicioEn.Date == fecha.Date).ToList();
                return new PuntoDatosDto
                {
                    Etiqueta = fecha.ToString("dd/MM", cultura),
                    Citas    = delDia.Count,
                    Ingresos = delDia.Where(c => c.Estado == EstadosCitas.Completada).Sum(c => c.Precio)
                };
            }).ToList();

            return Ok(datos);
        }
    }
}
