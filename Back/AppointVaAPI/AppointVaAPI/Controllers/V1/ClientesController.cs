using AppointVaAPI.Constants;
using System.ComponentModel.DataAnnotations;
using AppointVaAPI.Data;
using AppointVaAPI.Helpers;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Clientes;
using AppointVaAPI.Repository.IRepository;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    [Route("api/clientes")]
    [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
    [Authorize(Policy = Politicas.GestionCompleta)] // B10: client list, export source and global edits
    public class ClientesController : ControllerBase
    {
        private readonly IClienteRepository _repo;
        private readonly IContextoNegocio _contexto;
        private readonly ApplicationDbContext _db;
        private readonly IAuditService _audit;

        public ClientesController(
            IClienteRepository repo,
            IContextoNegocio contexto,
            ApplicationDbContext db,
            IAuditService audit)
        {
            _repo = repo;
            _contexto = contexto;
            _db = db;
            _audit = audit;
        }

        /// <summary>Audit action written for every export that carries client data (B18 / S7).</summary>
        public const string AccionExportarClientes = "ExportarClientes";

        /// <summary>Umbral por omisión, igual al que la pantalla trae preseleccionado.</summary>
        private const int DiasActividadPorDefecto = 60;
        private const string ActividadActivos = "activos";
        private const string ActividadInactivos = "inactivos";

        // GET api/clientes?buscar=&actividad=inactivos&dias=60&pagina=1&tamano=15
        [HttpGet]
        public async Task<IActionResult> ObtenerTodos(
            [FromQuery] string? buscar,
            [FromQuery] string? actividad,
            [FromQuery] int? dias,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 0)
        {
            if (_contexto.NegocioId is null) return Unauthorized();
            if (!ActividadEsValida(actividad)) return BadRequest(new { mensaje = MensajeActividadInvalida });
            if (!DiasEsValido(dias)) return BadRequest(new { mensaje = MensajeDiasInvalido });

            var query = FiltrarDirectorio(buscar);

            // El orden depende del grupo porque la pantalla los usa para cosas
            // distintas: los inactivos son una lista de a quién llamar, y ahí el
            // más abandonado va primero.
            IQueryable<Cliente> ordenada;
            if (EsActivos(actividad))
            {
                var umbral = UmbralActividad(dias);
                ordenada = query
                    .Where(c => c.UltimaCitaEn != null && c.UltimaCitaEn >= umbral)
                    .OrderByDescending(c => c.UltimaCitaEn);
            }
            else if (EsInactivos(actividad))
            {
                var umbral = UmbralActividad(dias);
                ordenada = query
                    .Where(c => c.UltimaCitaEn != null && c.UltimaCitaEn < umbral)
                    .OrderBy(c => c.UltimaCitaEn);
            }
            else
            {
                ordenada = query.OrderBy(c => c.NombreCompleto);
            }

            var lista = await ordenada
                .AsNoTracking()
                .ToListAsync();

            Response.Headers["X-Total-Count"] = lista.Count.ToString();

            var resultado = (tamano > 0
                ? lista.Skip((pagina - 1) * tamano).Take(tamano)
                : lista.AsEnumerable()).ToList();

            var visitas = await UltimasVisitasAsync(resultado.Select(c => c.Id));
            return Ok(resultado.Select(c => MapearDto(c, visitas.GetValueOrDefault(c.Id))));
        }

        // GET api/clientes/exportar?buscar=
        // B18 / decision 10: the whole directory (or the current search), not one page.
        // Owner-only (class-level GestionCompleta), rate limited, and every call is audited
        // with who, when, how many rows and the format the front turns it into.
        [HttpGet("exportar")]
        [EnableRateLimiting(Politicas.LimiteExportacion)]
        public async Task<IActionResult> Exportar([FromQuery] string? buscar)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var clientes = await FiltrarDirectorio(buscar)
                .OrderBy(c => c.NombreCompleto)
                .AsNoTracking()
                .Select(c => new ClienteExportacionDto
                {
                    Id = c.Id,
                    NombreCompleto = c.NombreCompleto,
                    Telefono = c.Telefono,
                    Email = c.Email,
                    TotalCitas = c.TotalCitas,
                    CantidadInasistencias = c.CantidadInasistencias,
                    UltimaCitaEn = c.UltimaCitaEn,
                    FechaCreacion = c.FechaCreacion
                })
                .ToListAsync();

            // La columna "Última visita" del archivo es la misma que la de la pantalla.
            var visitas = await UltimasVisitasAsync(clientes.Select(c => c.Id));
            foreach (var fila in clientes)
                fila.UltimaVisitaEn = visitas.GetValueOrDefault(fila.Id);

            var filtro = string.IsNullOrWhiteSpace(buscar) ? "directorio completo" : "búsqueda";
            // Fail closed: an export that left no audit row is not served.
            if (!await _audit.RegistrarObligatorioAsync(AccionExportarClientes, "Negocio", _contexto.NegocioId.ToString(),
                    $"Origen: clientes; Filas: {clientes.Count}; Formato: xlsx; Filtro: {filtro}"))
                return ExportacionNoDisponible(this);

            return Ok(clientes);
        }

        public const string MensajeExportacionNoDisponible =
            "No pudimos registrar la exportación, así que no se generó el archivo. Intenta de nuevo en unos minutos.";

        /// <summary>503 for an export whose mandatory audit row could not be written.</summary>
        internal static IActionResult ExportacionNoDisponible(ControllerBase controlador) =>
            controlador.StatusCode(StatusCodes.Status503ServiceUnavailable, new { mensaje = MensajeExportacionNoDisponible });

        // GET api/clientes/resumen-actividad?buscar=&dias=60
        // Los tres grupos del directorio completo: el listado está paginado y la
        // línea de cuadre de la pantalla tiene que sumar el total, no la página.
        [HttpGet("resumen-actividad")]
        public async Task<IActionResult> ResumenActividad(
            [FromQuery] string? buscar,
            [FromQuery] int? dias)
        {
            if (_contexto.NegocioId is null) return Unauthorized();
            if (!DiasEsValido(dias)) return BadRequest(new { mensaje = MensajeDiasInvalido });

            // Mismos predicados que ObtenerTodas para que los conteos cuadren con el listado.
            var query = FiltrarDirectorio(buscar);
            var umbral = UmbralActividad(dias);

            var total = await query.CountAsync();
            var sinVisitas = await query.CountAsync(c => c.UltimaCitaEn == null);
            var activos = await query.CountAsync(c => c.UltimaCitaEn != null && c.UltimaCitaEn >= umbral);

            return Ok(new ResumenActividadDto
            {
                Total = total,
                Activos = activos,
                // Por resta y no por un tercer COUNT: así los tres grupos suman el
                // total aunque se agende una cita entre una consulta y la siguiente.
                Inactivos = total - sinVisitas - activos,
                SinVisitas = sinVisitas,
            });
        }

        // GET api/clientes/{id}
        [HttpGet("{id:guid}")]
        public async Task<IActionResult> ObtenerPorId(Guid id)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var cliente = await _repo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (cliente is null) return NotFound(new { mensaje = "Cliente no encontrado" });

            return Ok(await MapearConVisitaAsync(cliente));
        }

        // GET api/clientes/{id}/citas
        [HttpGet("{id:guid}/citas")]
        public async Task<IActionResult> ObtenerCitas(Guid id)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var citas = await _db.Citas
                .Include(c => c.Servicio)
                .Include(c => c.Empleado)
                .Where(c => c.ClienteId == id && c.NegocioId == _contexto.NegocioId.Value)
                .OrderByDescending(c => c.InicioEn)
                .ToListAsync();

            return Ok(citas.Select(c => new
            {
                id = c.Id,
                nombreServicio = c.Servicio?.Nombre ?? string.Empty,
                nombreEmpleado = c.Empleado?.Nombre ?? string.Empty,
                inicioEn = c.InicioEn,
                precio = c.Precio,
                estado = c.Estado,
                estadoTexto = ObtenerEstadoTexto(c.Estado)
            }));
        }

        // PUT api/clientes/{id}
        // Edita los datos del cliente desde el directorio. El teléfono se guarda
        // sólo-dígitos, igual que al darlo de alta (ClienteRepository), y no puede
        // repetirse dentro del negocio; el correo tampoco.
        [HttpPut("{id:guid}")]
        public async Task<IActionResult> Actualizar(Guid id, [FromBody] ActualizarClienteDto dto)
        {
            if (_contexto.NegocioId is null) return Unauthorized();
            var negocioId = _contexto.NegocioId.Value;

            var nombre = dto.NombreCompleto?.Trim() ?? string.Empty;
            if (nombre.Length == 0)
                return BadRequest(new { mensaje = "El nombre es obligatorio" });

            string? telefono = null;
            if (!string.IsNullOrWhiteSpace(dto.Telefono))
            {
                telefono = NormalizacionHelper.SoloDigitos(dto.Telefono);
                if (telefono.Length < 7 || telefono.Length > 15)
                    return BadRequest(new { mensaje = "El teléfono no es válido" });
            }

            var email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim();
            if (email is not null && !new EmailAddressAttribute().IsValid(email))
                return BadRequest(new { mensaje = "El correo no es válido" });

            var cliente = await _repo.ObtenerPorIdAsync(id, negocioId);
            if (cliente is null) return NotFound(new { mensaje = "Cliente no encontrado" });

            if (telefono is not null)
            {
                // Las filas antiguas pueden guardar el teléfono con formato: se
                // compara contra el valor tal cual y contra su forma sólo-dígitos.
                var crudo = dto.Telefono!.Trim();
                var duplicado = await _db.Clientes.FirstOrDefaultAsync(c =>
                    c.NegocioId == negocioId &&
                    c.Id != cliente.Id &&
                    (c.Telefono == telefono || c.Telefono == crudo));
                if (duplicado is not null)
                    return Conflict(new { mensaje = $"Este teléfono ya está registrado para {duplicado.NombreCompleto}" });
            }

            if (email is not null)
            {
                var emailMin = email.ToLower();
                var duplicado = await _db.Clientes.FirstOrDefaultAsync(c =>
                    c.NegocioId == negocioId &&
                    c.Id != cliente.Id &&
                    c.Email != null && c.Email.ToLower() == emailMin);
                if (duplicado is not null)
                    return Conflict(new { mensaje = $"Este correo ya está registrado para {duplicado.NombreCompleto}" });
            }

            cliente.NombreCompleto = nombre;
            cliente.Telefono = telefono;
            cliente.Email = email;
            cliente.FechaActualizacion = DateTime.UtcNow;
            await _repo.ActualizarAsync(cliente);

            return Ok(await MapearConVisitaAsync(cliente));
        }

        // PATCH api/clientes/{id}/notas
        [HttpPatch("{id:guid}/notas")]
        public async Task<IActionResult> ActualizarNotas(Guid id, [FromBody] ActualizarNotasClienteDto dto)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var cliente = await _repo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (cliente is null) return NotFound(new { mensaje = "Cliente no encontrado" });

            cliente.Notas = dto.Notas;
            cliente.FechaActualizacion = DateTime.UtcNow;
            await _repo.ActualizarAsync(cliente);

            return Ok(await MapearConVisitaAsync(cliente));
        }

        // DELETE api/clientes/{id}
        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Eliminar(Guid id)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var eliminado = await _repo.EliminarAsync(id, _contexto.NegocioId.Value);
            if (!eliminado) return NotFound(new { mensaje = "Cliente no encontrado" });

            return NoContent();
        }

        private const string MensajeActividadInvalida =
            "El filtro de actividad solo acepta 'activos' o 'inactivos'.";
        private const string MensajeDiasInvalido =
            "El umbral en días debe ser mayor que cero.";

        private static bool EsActivos(string? actividad) =>
            string.Equals(actividad, ActividadActivos, StringComparison.OrdinalIgnoreCase);

        private static bool EsInactivos(string? actividad) =>
            string.Equals(actividad, ActividadInactivos, StringComparison.OrdinalIgnoreCase);

        private static bool ActividadEsValida(string? actividad) =>
            string.IsNullOrWhiteSpace(actividad) || EsActivos(actividad) || EsInactivos(actividad);

        private static bool DiasEsValido(int? dias) => !dias.HasValue || dias.Value > 0;

        /// <summary>
        /// Frontera entre activo e inactivo. `UltimaCitaEn` guarda el inicio de la
        /// última cita agendada, que puede estar en el futuro: quien ya tiene
        /// reserva por venir es activo. Justo sobre el corte cuenta como activo.
        /// </summary>
        private static DateTime UmbralActividad(int? dias) =>
            DateTime.UtcNow.AddDays(-(dias ?? DiasActividadPorDefecto));

        private IQueryable<Cliente> FiltrarDirectorio(string? buscar)
        {
            var query = _db.Clientes
                .Where(c => c.NegocioId == _contexto.NegocioId!.Value)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(buscar))
            {
                var b = buscar.ToLower().Trim();
                query = query.Where(c =>
                    c.NombreCompleto.ToLower().Contains(b) ||
                    c.Telefono.Contains(b));
            }

            return query;
        }

        /// <summary>
        /// Última visita de cada cliente: la última cita completada que ya
        /// empezó. No es `UltimaCitaEn`, que guarda la última cita agendada
        /// (puede estar en el futuro) y sigue mandando en Activos/Inactivos:
        /// quien ya tiene una reserva por venir no es un cliente perdido, pero
        /// "Última visita: 3 de noviembre" leído el 30 de octubre es falso.
        /// </summary>
        private async Task<Dictionary<Guid, DateTime?>> UltimasVisitasAsync(IEnumerable<Guid> clienteIds)
        {
            var ids = clienteIds.Distinct().ToList();
            if (ids.Count == 0) return new Dictionary<Guid, DateTime?>();

            var negocioId = _contexto.NegocioId!.Value;
            var ahora = DateTime.UtcNow;
            return await _db.Citas
                .Where(c => c.NegocioId == negocioId &&
                            ids.Contains(c.ClienteId) &&
                            c.Estado == EstadosCitas.Completada &&
                            c.InicioEn <= ahora)
                .GroupBy(c => c.ClienteId)
                .Select(g => new { ClienteId = g.Key, Ultima = g.Max(c => c.InicioEn) })
                .ToDictionaryAsync(x => x.ClienteId, x => (DateTime?)x.Ultima);
        }

        private async Task<object> MapearConVisitaAsync(Cliente c)
        {
            var visitas = await UltimasVisitasAsync(new[] { c.Id });
            return MapearDto(c, visitas.GetValueOrDefault(c.Id));
        }

        private static object MapearDto(Cliente c, DateTime? ultimaVisitaEn) => new
        {
            id = c.Id,
            nombreCompleto = c.NombreCompleto,
            telefono = c.Telefono,
            email = c.Email,
            notas = c.Notas,
            totalCitas = c.TotalCitas,
            cantidadInasistencias = c.CantidadInasistencias,
            ultimaCitaEn = c.UltimaCitaEn,
            ultimaVisitaEn = ultimaVisitaEn,
            fechaCreacion = c.FechaCreacion
        };

        private static string ObtenerEstadoTexto(byte estado) => estado switch
        {
            EstadosCitas.Pendiente => "Pendiente",
            EstadosCitas.Confirmada => "Confirmada",
            EstadosCitas.Completada => "Completada",
            EstadosCitas.Cancelada => "Cancelada",
            EstadosCitas.Inasistencia => "Inasistencia",
            _ => "Desconocido"
        };
    }

    /// <summary>One exported row. Internal notes are deliberately left out of the file.</summary>
    public class ClienteExportacionDto
    {
        /// <summary>Only to join the last visit; never written to the file.</summary>
        [System.Text.Json.Serialization.JsonIgnore]
        public Guid Id { get; set; }
        public string NombreCompleto { get; set; } = string.Empty;
        public string Telefono { get; set; } = string.Empty;
        public string? Email { get; set; }
        public int TotalCitas { get; set; }
        public int CantidadInasistencias { get; set; }
        public DateTime? UltimaCitaEn { get; set; }
        public DateTime? UltimaVisitaEn { get; set; }
        public DateTime FechaCreacion { get; set; }
    }

    public class ActualizarNotasClienteDto
    {
        public string? Notas { get; set; }
    }
}
