using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Clientes;
using AppointVaAPI.Repository.IRepository;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    [Route("api/clientes")]
    [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
    public class ClientesController : ControllerBase
    {
        private readonly IClienteRepository _repo;
        private readonly IContextoNegocio _contexto;
        private readonly ApplicationDbContext _db;

        public ClientesController(
            IClienteRepository repo,
            IContextoNegocio contexto,
            ApplicationDbContext db)
        {
            _repo = repo;
            _contexto = contexto;
            _db = db;
        }

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

            var resultado = tamano > 0
                ? lista.Skip((pagina - 1) * tamano).Take(tamano)
                : lista.AsEnumerable();

            return Ok(resultado.Select(MapearDto));
        }

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

            return Ok(MapearDto(cliente));
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

            return Ok(MapearDto(cliente));
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

        private static object MapearDto(Cliente c) => new
        {
            id = c.Id,
            nombreCompleto = c.NombreCompleto,
            telefono = c.Telefono,
            email = c.Email,
            notas = c.Notas,
            totalCitas = c.TotalCitas,
            cantidadInasistencias = c.CantidadInasistencias,
            ultimaCitaEn = c.UltimaCitaEn,
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

    public class ActualizarNotasClienteDto
    {
        public string? Notas { get; set; }
    }
}
