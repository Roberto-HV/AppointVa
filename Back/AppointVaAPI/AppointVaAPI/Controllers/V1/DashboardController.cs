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

            var ahora = DateTime.Today;
            var finHoy = ahora.AddDays(1);
            var diaSemana = (int)ahora.DayOfWeek;
            var inicioSemana = ahora.AddDays(diaSemana == 0 ? -6 : -(diaSemana - 1));
            var inicioMes = new DateTime(ahora.Year, ahora.Month, 1);

            var todasCitas = await _db.Citas
                .Include(c => c.Cliente)
                .Include(c => c.Empleado)
                .Include(c => c.Servicio)
                .Where(c => c.NegocioId == negocioId && c.InicioEn >= inicioMes)
                .ToListAsync();

            var completadasHoy = todasCitas.Where(c =>
                c.Estado == EstadosCitas.Completada &&
                c.InicioEn >= ahora && c.InicioEn < finHoy).ToList();

            var completadasSemana = todasCitas.Where(c =>
                c.Estado == EstadosCitas.Completada &&
                c.InicioEn >= inicioSemana).ToList();

            var completadasMes = todasCitas.Where(c =>
                c.Estado == EstadosCitas.Completada).ToList();

            var citasHoy = todasCitas.Count(c => c.InicioEn >= ahora && c.InicioEn < finHoy);
            var citasSemana = todasCitas.Count(c => c.InicioEn >= inicioSemana);
            var citasMes = todasCitas.Count;

            var proximas = todasCitas
                .Where(c =>
                    c.InicioEn >= DateTime.Now &&
                    (c.Estado == EstadosCitas.Pendiente || c.Estado == EstadosCitas.Confirmada))
                .OrderBy(c => c.InicioEn)
                .Take(5)
                .Select(c => new CitaResumenDto
                {
                    Id = c.Id,
                    CodigoConfirmacion = c.CodigoConfirmacion,
                    NombreCliente = c.Cliente?.NombreCompleto ?? string.Empty,
                    NombreServicio = c.Servicio?.Nombre ?? string.Empty,
                    NombreEmpleado = c.Empleado?.Nombre ?? string.Empty,
                    InicioEn = c.InicioEn,
                    Estado = c.Estado,
                    EstadoTexto = PublicoController.ObtenerEstadoTexto(c.Estado)
                })
                .ToList();

            var topServicios = todasCitas
                .Where(c => c.Servicio is not null)
                .GroupBy(c => c.Servicio!.Nombre)
                .Select(g => new ServicioPopularDto
                {
                    NombreServicio = g.Key,
                    TotalCitas = g.Count()
                })
                .OrderByDescending(s => s.TotalCitas)
                .Take(5)
                .ToList();

            return Ok(new ResumenDashboardDto
            {
                CitasHoy = citasHoy,
                CitasSemana = citasSemana,
                CitasMes = citasMes,
                IngresosHoy = completadasHoy.Sum(c => c.Precio),
                IngresosSemana = completadasSemana.Sum(c => c.Precio),
                IngresosMes = completadasMes.Sum(c => c.Precio),
                ProximasCitas = proximas,
                TopServicios = topServicios
            });
        }

        // GET api/dashboard/tendencia?dias=14
        [HttpGet("tendencia")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> ObtenerTendencia([FromQuery] int dias = 14)
        {
            if (_contexto.NegocioId is null) return Unauthorized();
            var negocioId = _contexto.NegocioId.Value;

            var inicio = DateTime.Today.AddDays(-(dias - 1));

            var citas = await _db.Citas
                .Where(c => c.NegocioId == negocioId &&
                            c.InicioEn >= inicio &&
                            c.InicioEn < DateTime.Today.AddDays(1))
                .Select(c => new { c.InicioEn, c.Estado, c.Precio })
                .ToListAsync();

            var datos = new List<PuntoDatosDto>();
            var cultura = new CultureInfo("es-MX");
            for (var i = 0; i < dias; i++)
            {
                var fecha = inicio.AddDays(i);
                var delDia = citas.Where(c => c.InicioEn.Date == fecha.Date).ToList();
                datos.Add(new PuntoDatosDto
                {
                    Etiqueta = fecha.ToString("dd/MM", cultura),
                    Citas = delDia.Count,
                    Ingresos = delDia
                        .Where(c => c.Estado == EstadosCitas.Completada)
                        .Sum(c => c.Precio)
                });
            }

            return Ok(datos);
        }
    }
}
