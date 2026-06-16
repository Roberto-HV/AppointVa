using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models.Dtos.Reportes;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    [Route("api/reportes")]
    [Authorize(Roles = Roles.Propietario)]
    public class ReportesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IContextoNegocio _contexto;

        public ReportesController(ApplicationDbContext db, IContextoNegocio contexto)
        {
            _db = db;
            _contexto = contexto;
        }

        // GET api/reportes/citas?desde=&hasta=&empleadoId=&servicioId=&estado=
        [HttpGet("citas")]
        public async Task<IActionResult> ReporteCitas(
            [FromQuery] DateTime? desde,
            [FromQuery] DateTime? hasta,
            [FromQuery] Guid? empleadoId,
            [FromQuery] Guid? servicioId,
            [FromQuery] byte? estado)
        {
            if (_contexto.NegocioId is null) return Unauthorized();
            var negocioId = _contexto.NegocioId.Value;

            var (desdeUtc, hastaUtc) = NormalizarRango(desde, hasta);

            var query = _db.Citas
                .Include(c => c.Cliente)
                .Include(c => c.Empleado)
                .Include(c => c.Servicio)
                .Where(c => c.NegocioId == negocioId && c.InicioEn >= desdeUtc && c.InicioEn < hastaUtc)
                .AsNoTracking()
                .AsQueryable();

            if (empleadoId.HasValue)   query = query.Where(c => c.EmpleadoId == empleadoId.Value);
            if (servicioId.HasValue)   query = query.Where(c => c.ServicioId == servicioId.Value);
            if (estado.HasValue)       query = query.Where(c => c.Estado == estado.Value);

            var citas = await query.OrderBy(c => c.InicioEn).ToListAsync();

            var completadas = citas.Where(c => c.Estado == EstadosCitas.Completada).ToList();

            var dto = new ReporteCitasDto
            {
                TotalCitas          = citas.Count,
                TotalCompletadas    = completadas.Count,
                TotalCanceladas     = citas.Count(c => c.Estado == EstadosCitas.Cancelada),
                TotalPendientes     = citas.Count(c => c.Estado == EstadosCitas.Pendiente || c.Estado == EstadosCitas.Confirmada),
                TotalInasistencias  = citas.Count(c => c.Estado == EstadosCitas.Inasistencia),
                TotalIngresos       = completadas.Sum(c => c.Precio),
                TotalIngresosEfectivo = completadas
                    .Where(c => c.Pagada && c.MetodoPago?.ToLower() == "efectivo")
                    .Sum(c => c.Precio),
                TotalIngresosTarjeta = completadas
                    .Where(c => c.Pagada && c.MetodoPago?.ToLower() == "tarjeta")
                    .Sum(c => c.Precio),
                Citas = citas.Select(c => new FilaCitaReporteDto
                {
                    Id                  = c.Id,
                    CodigoConfirmacion  = c.CodigoConfirmacion,
                    NombreCliente       = c.Cliente?.NombreCompleto ?? string.Empty,
                    TelefonoCliente     = c.Cliente?.Telefono ?? string.Empty,
                    EmailCliente        = c.Cliente?.Email,
                    NombreServicio      = c.Servicio?.Nombre ?? string.Empty,
                    NombreEmpleado      = c.Empleado?.Nombre ?? string.Empty,
                    InicioEn            = c.InicioEn,
                    DuracionMinutos     = c.Servicio?.DuracionMinutos ?? 0,
                    Precio              = c.Precio,
                    Pagada              = c.Pagada,
                    MetodoPago          = c.MetodoPago,
                    Estado              = c.Estado,
                    EstadoTexto         = PublicoController.ObtenerEstadoTexto(c.Estado),
                    Notas               = c.Notas
                }).ToList()
            };

            return Ok(dto);
        }

        // GET api/reportes/citas/exportar — descarga CSV
        [HttpGet("citas/exportar")]
        public async Task<IActionResult> ExportarCitasCsv(
            [FromQuery] DateTime? desde,
            [FromQuery] DateTime? hasta,
            [FromQuery] Guid? empleadoId,
            [FromQuery] Guid? servicioId,
            [FromQuery] byte? estado)
        {
            if (_contexto.NegocioId is null) return Unauthorized();
            var negocioId = _contexto.NegocioId.Value;

            var (desdeUtc, hastaUtc) = NormalizarRango(desde, hasta);

            var query = _db.Citas
                .Include(c => c.Cliente)
                .Include(c => c.Empleado)
                .Include(c => c.Servicio)
                .Where(c => c.NegocioId == negocioId && c.InicioEn >= desdeUtc && c.InicioEn < hastaUtc)
                .AsNoTracking()
                .AsQueryable();

            if (empleadoId.HasValue)  query = query.Where(c => c.EmpleadoId == empleadoId.Value);
            if (servicioId.HasValue)  query = query.Where(c => c.ServicioId == servicioId.Value);
            if (estado.HasValue)      query = query.Where(c => c.Estado == estado.Value);

            var citas = await query.OrderBy(c => c.InicioEn).ToListAsync();

            var cultura = new CultureInfo("es-MX");
            var sb = new StringBuilder();
            sb.AppendLine("Código,Cliente,Teléfono,Email,Servicio,Empleado,Fecha,Duración (min),Precio,Pagada,Método de pago,Estado,Notas");

            foreach (var c in citas)
            {
                var campos = new[]
                {
                    Escapar(c.CodigoConfirmacion),
                    Escapar(c.Cliente?.NombreCompleto ?? ""),
                    Escapar(c.Cliente?.Telefono ?? ""),
                    Escapar(c.Cliente?.Email ?? ""),
                    Escapar(c.Servicio?.Nombre ?? ""),
                    Escapar(c.Empleado?.Nombre ?? ""),
                    c.InicioEn.ToString("dd/MM/yyyy HH:mm", cultura),
                    (c.Servicio?.DuracionMinutos ?? 0).ToString(),
                    c.Precio.ToString("F2", cultura),
                    c.Pagada ? "Sí" : "No",
                    Escapar(c.MetodoPago ?? ""),
                    PublicoController.ObtenerEstadoTexto(c.Estado),
                    Escapar(c.Notas ?? "")
                };
                sb.AppendLine(string.Join(",", campos));
            }

            var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
            var nombreArchivo = $"citas_{desdeUtc:yyyyMMdd}_{hastaUtc.AddDays(-1):yyyyMMdd}.csv";
            return File(bytes, "text/csv; charset=utf-8", nombreArchivo);
        }

        // GET api/reportes/ingresos?desde=&hasta=
        [HttpGet("ingresos")]
        public async Task<IActionResult> ReporteIngresos(
            [FromQuery] DateTime? desde,
            [FromQuery] DateTime? hasta)
        {
            if (_contexto.NegocioId is null) return Unauthorized();
            var negocioId = _contexto.NegocioId.Value;

            var (desdeUtc, hastaUtc) = NormalizarRango(desde, hasta);
            var cultura = new CultureInfo("es-MX");

            var baseQuery = _db.Citas
                .Where(c => c.NegocioId == negocioId &&
                            c.Estado == EstadosCitas.Completada &&
                            c.InicioEn >= desdeUtc &&
                            c.InicioEn < hastaUtc)
                .AsNoTracking();

            // Totales en SQL
            var totalCitas    = await baseQuery.CountAsync();
            var totalIngresos = await baseQuery.SumAsync(c => (decimal?)c.Precio) ?? 0m;

            // Por servicio en SQL
            var porServicio = await baseQuery
                .Where(c => c.Servicio != null)
                .GroupBy(c => new { c.ServicioId, NombreServicio = c.Servicio!.Nombre })
                .Select(g => new IngresosPorServicioDto
                {
                    ServicioId     = g.Key.ServicioId,
                    NombreServicio = g.Key.NombreServicio,
                    TotalCitas     = g.Count(),
                    TotalIngresos  = g.Sum(c => c.Precio),
                    Porcentaje     = 0
                })
                .OrderByDescending(x => x.TotalIngresos)
                .ToListAsync();

            // Calcular porcentaje en memoria (solo N registros ya agrupados)
            foreach (var s in porServicio)
                s.Porcentaje = totalIngresos > 0 ? Math.Round(s.TotalIngresos / totalIngresos * 100, 1) : 0;

            // Por empleado en SQL
            var porEmpleado = await baseQuery
                .Where(c => c.Empleado != null)
                .GroupBy(c => new { c.EmpleadoId, NombreEmpleado = c.Empleado!.Nombre })
                .Select(g => new IngresosPorEmpleadoDto
                {
                    EmpleadoId     = g.Key.EmpleadoId,
                    NombreEmpleado = g.Key.NombreEmpleado,
                    TotalCitas     = g.Count(),
                    TotalIngresos  = g.Sum(c => c.Precio)
                })
                .OrderByDescending(x => x.TotalIngresos)
                .ToListAsync();

            // Por día — agrupar por fecha en memoria (requiere materializar sólo fecha+precio)
            var puntosDia = await baseQuery
                .Select(c => new { c.InicioEn, c.Precio })
                .ToListAsync();

            var porDia = puntosDia
                .GroupBy(c => c.InicioEn.Date)
                .OrderBy(g => g.Key)
                .Select(g => new IngresosPorDiaDto
                {
                    Fecha         = g.Key.ToString("dd/MM/yyyy", cultura),
                    TotalCitas    = g.Count(),
                    TotalIngresos = g.Sum(c => c.Precio)
                })
                .ToList();

            return Ok(new ReporteIngresosDto
            {
                TotalIngresos         = totalIngresos,
                TotalCitasCompletadas = totalCitas,
                TicketPromedio        = totalCitas > 0 ? Math.Round(totalIngresos / totalCitas, 2) : 0,
                PorServicio           = porServicio,
                PorEmpleado           = porEmpleado,
                PorDia                = porDia
            });
        }

        // GET api/reportes/heatmap?desde=&hasta=
        [HttpGet("heatmap")]
        public async Task<IActionResult> HeatmapHorasPico([FromQuery] DateTime? desde, [FromQuery] DateTime? hasta)
        {
            if (_contexto.NegocioId is null) return Unauthorized();
            var negocioId = _contexto.NegocioId.Value;
            var (desdeUtc, hastaUtc) = NormalizarRango(desde, hasta);

            var puntos = await _db.Citas
                .Where(c => c.NegocioId == negocioId
                       && c.InicioEn >= desdeUtc && c.InicioEn < hastaUtc
                       && c.Estado != EstadosCitas.Cancelada)
                .Select(c => new { c.InicioEn })
                .AsNoTracking()
                .ToListAsync();

            // matriz[hora][dia]: hora 0-23, dia 0=Lun 6=Dom
            var matriz = Enumerable.Range(0, 24).Select(_ => new int[7]).ToArray();
            foreach (var p in puntos)
            {
                var hora = p.InicioEn.Hour;
                var dia = ((int)p.InicioEn.DayOfWeek + 6) % 7;
                matriz[hora][dia]++;
            }

            var maximo = matriz.SelectMany(r => r).DefaultIfEmpty(0).Max();
            int horaPico = 9, diaPico = 4, maxVal = 0;
            for (int h = 0; h < 24; h++)
                for (int d = 0; d < 7; d++)
                    if (matriz[h][d] > maxVal) { maxVal = matriz[h][d]; horaPico = h; diaPico = d; }

            var diasNombres = new[] { "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo" };
            return Ok(new
            {
                matriz = matriz.Select(r => r.ToList()).ToList(),
                maximo = Math.Max(1, maximo),
                totalCitas = puntos.Count,
                horaPico = puntos.Any() ? $"{horaPico:D2}:00" : "--",
                diaPico = puntos.Any() ? diasNombres[diaPico] : "--",
            });
        }

        // GET api/reportes/retencion?desde=&hasta=
        [HttpGet("retencion")]
        public async Task<IActionResult> TasaRetencion([FromQuery] DateTime? desde, [FromQuery] DateTime? hasta)
        {
            if (_contexto.NegocioId is null) return Unauthorized();
            var negocioId = _contexto.NegocioId.Value;
            var (desdeUtc, hastaUtc) = NormalizarRango(desde, hasta);

            var clientesPeriodo = await _db.Citas
                .Where(c => c.NegocioId == negocioId
                       && c.InicioEn >= desdeUtc && c.InicioEn < hastaUtc
                       && c.Estado != EstadosCitas.Cancelada)
                .Select(c => c.ClienteId)
                .Distinct()
                .ToListAsync();

            var totalClientes = clientesPeriodo.Count;
            var clientesRecurrentes = 0;
            if (clientesPeriodo.Any())
            {
                clientesRecurrentes = await _db.Citas
                    .Where(c => c.NegocioId == negocioId
                           && c.InicioEn < desdeUtc
                           && clientesPeriodo.Contains(c.ClienteId))
                    .Select(c => c.ClienteId)
                    .Distinct()
                    .CountAsync();
            }

            var tasaRetencion = totalClientes > 0
                ? Math.Round((double)clientesRecurrentes / totalClientes * 100, 1)
                : 0.0;

            var ahora = DateTime.UtcNow;
            var inicioMes = new DateTime(ahora.Year, ahora.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var finMes = inicioMes.AddMonths(1);

            var ingresoCompletado = await _db.Citas
                .Where(c => c.NegocioId == negocioId
                       && c.InicioEn >= inicioMes && c.InicioEn < finMes
                       && c.Estado == EstadosCitas.Completada)
                .SumAsync(c => (decimal?)c.Precio) ?? 0m;

            var ingresoAgendado = await _db.Citas
                .Where(c => c.NegocioId == negocioId
                       && c.InicioEn >= ahora && c.InicioEn < finMes
                       && (c.Estado == EstadosCitas.Pendiente || c.Estado == EstadosCitas.Confirmada))
                .SumAsync(c => (decimal?)c.Precio) ?? 0m;

            return Ok(new
            {
                totalClientes,
                clientesRecurrentes,
                clientesNuevos = totalClientes - clientesRecurrentes,
                tasaRetencion,
                ingresoMesActual = ingresoCompletado,
                proyeccionMes = ingresoCompletado + ingresoAgendado,
                ingresoAgendado,
                diasRestantesMes = (int)Math.Ceiling(Math.Max(0, (finMes - ahora).TotalDays)),
            });
        }

        private static (DateTime desde, DateTime hasta) NormalizarRango(DateTime? desde, DateTime? hasta)
        {
            var ahora = DateTime.UtcNow;
            var desdeUtc = desde.HasValue
                ? DateTime.SpecifyKind(desde.Value.Date, DateTimeKind.Utc)
                : new DateTime(ahora.Year, ahora.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var hastaUtc = hasta.HasValue
                ? DateTime.SpecifyKind(hasta.Value.Date.AddDays(1), DateTimeKind.Utc)
                : desdeUtc.AddMonths(1);
            return (desdeUtc, hastaUtc);
        }

        private static string Escapar(string valor)
        {
            if (valor.Contains(',') || valor.Contains('"') || valor.Contains('\n'))
                return $"\"{valor.Replace("\"", "\"\"")}\"";
            return valor;
        }
    }
}
