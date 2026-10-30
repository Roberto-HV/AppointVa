using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Reportes;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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
        private readonly IAuditService _audit;

        public ReportesController(ApplicationDbContext db, IContextoNegocio contexto, IAuditService audit)
        {
            _db = db;
            _contexto = contexto;
            _audit = audit;
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
            return Ok(await ConstruirReporteCitasAsync(_contexto.NegocioId.Value, desde, hasta, empleadoId, servicioId, estado));
        }

        // GET api/reportes/citas/exportacion — the same report, for the Excel file (S7)
        // Every row carries client name, phone and email, so building the file goes
        // through here: owner-only, rate limited and audited like the client export.
        [HttpGet("citas/exportacion")]
        [Authorize(Policy = Politicas.GestionCompleta)]
        [EnableRateLimiting(Politicas.LimiteExportacion)]
        public async Task<IActionResult> ExportacionCitas(
            [FromQuery] DateTime? desde,
            [FromQuery] DateTime? hasta,
            [FromQuery] Guid? empleadoId,
            [FromQuery] Guid? servicioId,
            [FromQuery] byte? estado)
        {
            if (_contexto.NegocioId is null) return Unauthorized();
            var dto = await ConstruirReporteCitasAsync(_contexto.NegocioId.Value, desde, hasta, empleadoId, servicioId, estado);
            if (!await RegistrarExportacionAsync("reporte de citas", dto.Citas.Count, "xlsx"))
                return ClientesController.ExportacionNoDisponible(this);
            return Ok(dto);
        }

        // Fail closed (S7): false means no audit row, and the caller must not serve the data.
        private Task<bool> RegistrarExportacionAsync(string origen, int filas, string formato) =>
            _audit.RegistrarObligatorioAsync(ClientesController.AccionExportarClientes, "Negocio", _contexto.NegocioId.ToString(),
                $"Origen: {origen}; Filas: {filas}; Formato: {formato}");

        private async Task<ReporteCitasDto> ConstruirReporteCitasAsync(
            Guid negocioId, DateTime? desde, DateTime? hasta, Guid? empleadoId, Guid? servicioId, byte? estado)
        {
            var (desdeUtc, hastaUtc) = NormalizarRango(desde, hasta);
            var (citas, clientes) = await ObtenerCitasDelRangoAsync(negocioId, desdeUtc, hastaUtc, empleadoId, servicioId, estado);

            var completadas = citas.Where(c => c.Estado == EstadosCitas.Completada).ToList();
            var canceladas = citas.Count(c => c.Estado == EstadosCitas.Cancelada);
            var inasistencias = citas.Count(c => c.Estado == EstadosCitas.Inasistencia);

            var dto = new ReporteCitasDto
            {
                TotalCitas          = citas.Count,
                TotalVigentes       = citas.Count - canceladas - inasistencias,
                TotalCompletadas    = completadas.Count,
                TotalCanceladas     = canceladas,
                TotalPendientes     = citas.Count(c => c.Estado == EstadosCitas.Pendiente || c.Estado == EstadosCitas.Confirmada),
                TotalInasistencias  = inasistencias,
                TotalIngresos       = completadas.Sum(c => c.MontoCobrado ?? c.Precio),
                TotalIngresosEfectivo = completadas
                    .Where(c => c.Pagada && (
                        string.Equals(c.MetodoPago, "Efectivo", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(c.MetodoPago2, "Efectivo", StringComparison.OrdinalIgnoreCase)))
                    .Sum(c =>
                    {
                        decimal total = c.MontoCobrado ?? c.Precio;
                        decimal m2    = c.MontoPago2 ?? 0m;
                        decimal m1    = total - m2;
                        decimal result = 0m;
                        if (string.Equals(c.MetodoPago,  "Efectivo", StringComparison.OrdinalIgnoreCase)) result += m1;
                        if (string.Equals(c.MetodoPago2, "Efectivo", StringComparison.OrdinalIgnoreCase)) result += m2;
                        return result;
                    }),
                TotalIngresosTarjeta = completadas
                    .Where(c => c.Pagada && (
                        string.Equals(c.MetodoPago, "Tarjeta", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(c.MetodoPago2, "Tarjeta", StringComparison.OrdinalIgnoreCase)))
                    .Sum(c =>
                    {
                        decimal total = c.MontoCobrado ?? c.Precio;
                        decimal m2    = c.MontoPago2 ?? 0m;
                        decimal m1    = total - m2;
                        decimal result = 0m;
                        if (string.Equals(c.MetodoPago,  "Tarjeta", StringComparison.OrdinalIgnoreCase)) result += m1;
                        if (string.Equals(c.MetodoPago2, "Tarjeta", StringComparison.OrdinalIgnoreCase)) result += m2;
                        return result;
                    }),
                Citas = citas.Select(c => new FilaCitaReporteDto
                {
                    Id                  = c.Id,
                    CodigoConfirmacion  = c.CodigoConfirmacion,
                    NombreCliente       = clientes.GetValueOrDefault(c.ClienteId)?.NombreCompleto ?? ClienteEliminado,
                    TelefonoCliente     = clientes.GetValueOrDefault(c.ClienteId)?.Telefono ?? string.Empty,
                    EmailCliente        = clientes.GetValueOrDefault(c.ClienteId)?.Email,
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

            return dto;
        }

        /// <summary>Name shown for an appointment whose client was deleted (soft delete).</summary>
        public const string ClienteEliminado = AppointVaAPI.Helpers.ClientesDeCitasHelper.ClienteEliminado;

        /// <summary>
        /// Appointments of the range with employee and service, plus their clients by id.
        /// G3: Cita.Cliente is a required navigation and Cliente has a soft-delete query
        /// filter, so Include(c => c.Cliente) became an INNER JOIN that silently dropped
        /// every appointment of a deleted client (October: 16 in the database, 9 here).
        /// Clients are read apart through the same filter: the appointment always counts,
        /// and a deleted client's contact data is not served again (missing from the map).
        /// </summary>
        private async Task<(List<Cita> citas, Dictionary<Guid, Cliente> clientes)> ObtenerCitasDelRangoAsync(
            Guid negocioId, DateTime desdeUtc, DateTime hastaUtc, Guid? empleadoId, Guid? servicioId, byte? estado)
        {
            var query = _db.Citas
                .Include(c => c.Empleado)
                .Include(c => c.Servicio)
                .Where(c => c.NegocioId == negocioId && c.InicioEn >= desdeUtc && c.InicioEn < hastaUtc)
                .AsNoTracking();

            if (empleadoId.HasValue)  query = query.Where(c => c.EmpleadoId == empleadoId.Value);
            if (servicioId.HasValue)  query = query.Where(c => c.ServicioId == servicioId.Value);
            if (estado.HasValue)      query = query.Where(c => c.Estado == estado.Value);

            var citas = await query.OrderBy(c => c.InicioEn).ToListAsync();

            var clientes = await AppointVaAPI.Helpers.ClientesDeCitasHelper.CargarAsync(
                _db, negocioId, citas.Select(c => c.ClienteId));

            return (citas, clientes);
        }

        // GET api/reportes/citas/exportar — descarga CSV
        [HttpGet("citas/exportar")]
        [Authorize(Policy = Politicas.GestionCompleta)] // B10: exports are never available to Empleado
        [EnableRateLimiting(Politicas.LimiteExportacion)] // S7: client data, audited below
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
            var (citas, clientes) = await ObtenerCitasDelRangoAsync(negocioId, desdeUtc, hastaUtc, empleadoId, servicioId, estado);

            var cultura = new CultureInfo("es-MX");
            var sb = new StringBuilder();
            sb.AppendLine("Código,Cliente,Teléfono,Email,Servicio,Empleado,Fecha,Duración (min),Precio,Pagada,Método de pago,Estado,Notas");

            foreach (var c in citas)
            {
                var cliente = clientes.GetValueOrDefault(c.ClienteId);
                var campos = new[]
                {
                    Escapar(c.CodigoConfirmacion),
                    Escapar(cliente?.NombreCompleto ?? ClienteEliminado),
                    Escapar(cliente?.Telefono ?? ""),
                    Escapar(cliente?.Email ?? ""),
                    Escapar(c.Servicio?.Nombre ?? ""),
                    Escapar(c.Empleado?.Nombre ?? ""),
                    c.InicioEn.ToString("dd/MM/yyyy h:mm tt", System.Globalization.CultureInfo.InvariantCulture),
                    (c.Servicio?.DuracionMinutos ?? 0).ToString(),
                    c.Precio.ToString("F2", cultura),
                    c.Pagada ? "Sí" : "No",
                    Escapar(c.MetodoPago ?? ""),
                    PublicoController.ObtenerEstadoTexto(c.Estado),
                    Escapar(c.Notas ?? "")
                };
                sb.AppendLine(string.Join(",", campos));
            }

            if (!await RegistrarExportacionAsync("citas (CSV)", citas.Count, "csv"))
                return ClientesController.ExportacionNoDisponible(this);

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

        /// <summary>
        /// CSV cell. S9: a cell that starts with = + - @ (or tab / carriage return) is run
        /// as a formula when the file is opened in a spreadsheet, so it gets a leading
        /// apostrophe. Plain numbers and phone numbers ("+52 55 1234 5678", "-15") have no
        /// letters or symbols to build a payload from and are left as they are.
        /// </summary>
        public static string Escapar(string valor)
        {
            if (valor.Length > 0 && "=+-@\t\r".Contains(valor[0]) && !PareceNumeroOTelefono(valor))
                valor = "'" + valor;
            if (valor.Contains(',') || valor.Contains('"') || valor.Contains('\n') || valor.Contains('\r'))
                return $"\"{valor.Replace("\"", "\"\"")}\"";
            return valor;
        }

        private static readonly System.Text.RegularExpressions.Regex NumeroOTelefono =
            new(@"^[+-]?[0-9 ().\-]+$", System.Text.RegularExpressions.RegexOptions.CultureInvariant);

        private static bool PareceNumeroOTelefono(string valor) => NumeroOTelefono.IsMatch(valor);
    }
}
