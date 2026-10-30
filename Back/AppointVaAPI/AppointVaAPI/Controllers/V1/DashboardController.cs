using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Helpers;
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
            var finSemana = inicioSemana.AddDays(7);
            var inicioMes = new DateTime(hoyInicio.Year, hoyInicio.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var finMes = inicioMes.AddMonths(1);

            var base_ = _db.Citas.Where(c => c.NegocioId == negocioId);

            // Conteos — SQL COUNT. Una sola definición de "cita" para Inicio, Pagos
            // y la agenda: las canceladas y las inasistencias no cuentan. Antes
            // "Hoy 1" convivía con "Sin citas para hoy" cuando la única cita del
            // día estaba cancelada. Semana y Mes llevan tope: sin él sumaban
            // también las reservas de semanas y meses siguientes.
            var vigentes = base_.Where(c =>
                c.Estado != EstadosCitas.Cancelada && c.Estado != EstadosCitas.Inasistencia);
            var citasHoy     = await vigentes.CountAsync(c => c.InicioEn >= hoyInicio && c.InicioEn < hoyFin);
            var citasSemana  = await vigentes.CountAsync(c => c.InicioEn >= inicioSemana && c.InicioEn < finSemana);
            var citasMes     = await vigentes.CountAsync(c => c.InicioEn >= inicioMes && c.InicioEn < finMes);

            // Ingresos — SQL SUM sobre completadas
            var completadasBase = base_.Where(c => c.Estado == EstadosCitas.Completada);
            var ingresosHoy    = await completadasBase.Where(c => c.InicioEn >= hoyInicio && c.InicioEn < hoyFin).SumAsync(c => c.Precio);
            var ingresosSemana = await completadasBase.Where(c => c.InicioEn >= inicioSemana && c.InicioEn < finSemana).SumAsync(c => c.Precio);
            var ingresosMes    = await completadasBase.Where(c => c.InicioEn >= inicioMes && c.InicioEn < finMes).SumAsync(c => c.Precio);

            // Próximas 5 citas — carga mínima con proyección. The client name is resolved
            // apart (ClientesDeCitasHelper): projecting c.Cliente was an INNER JOIN through
            // the soft-delete filter and hid a deleted client's upcoming appointment.
            var proximasFilas = await base_
                .Where(c => c.InicioEn >= ahora &&
                            (c.Estado == EstadosCitas.Pendiente || c.Estado == EstadosCitas.Confirmada))
                .OrderBy(c => c.InicioEn)
                .Take(5)
                .Select(c => new
                {
                    c.Id,
                    c.CodigoConfirmacion,
                    c.ClienteId,
                    NombreServicio = c.Servicio != null ? c.Servicio.Nombre : string.Empty,
                    NombreEmpleado = c.Empleado != null ? c.Empleado.Nombre : string.Empty,
                    c.InicioEn,
                    c.Estado,
                })
                .ToListAsync();
            var clientesProximas = await ClientesDeCitasHelper.CargarAsync(
                _db, negocioId, proximasFilas.Select(c => c.ClienteId));
            var proximas = proximasFilas.Select(c => new CitaResumenDto
            {
                Id = c.Id,
                CodigoConfirmacion = c.CodigoConfirmacion,
                NombreCliente  = ClientesDeCitasHelper.Nombre(clientesProximas.GetValueOrDefault(c.ClienteId)),
                NombreServicio = c.NombreServicio,
                NombreEmpleado = c.NombreEmpleado,
                InicioEn   = c.InicioEn,
                Estado     = c.Estado,
                EstadoTexto = PublicoController.ObtenerEstadoTexto(c.Estado)
            }).ToList();

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
