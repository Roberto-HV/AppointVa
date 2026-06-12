using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
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

        // GET api/clientes?buscar=&pagina=1&tamano=100
        [HttpGet]
        public async Task<IActionResult> ObtenerTodos(
            [FromQuery] string? buscar,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 0)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var query = _db.Clientes
                .Where(c => c.NegocioId == _contexto.NegocioId.Value)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(buscar))
            {
                var b = buscar.ToLower().Trim();
                query = query.Where(c =>
                    c.NombreCompleto.ToLower().Contains(b) ||
                    c.Telefono.Contains(b));
            }

            var lista = await query
                .OrderBy(c => c.NombreCompleto)
                .AsNoTracking()
                .ToListAsync();

            Response.Headers["X-Total-Count"] = lista.Count.ToString();

            var resultado = tamano > 0
                ? lista.Skip((pagina - 1) * tamano).Take(tamano)
                : lista.AsEnumerable();

            return Ok(resultado.Select(MapearDto));
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
