using AppointVaAPI.Constants;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Servicios;
using AppointVaAPI.Repository.IRepository;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    [Route("api/servicios")]
    [Authorize]
    public class ServiciosController : ControllerBase
    {
        private readonly IServicioRepository _repo;
        private readonly IContextoNegocio _contexto;
        private readonly IBlobStorageService _storage;

        public ServiciosController(IServicioRepository repo, IContextoNegocio contexto, IBlobStorageService storage)
        {
            _repo = repo;
            _contexto = contexto;
            _storage = storage;
        }

        // GET api/servicios
        [HttpGet]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.Empleado},{Roles.SuperAdmin}")]
        public async Task<IActionResult> ObtenerTodos([FromQuery] bool incluirInactivos = false)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var lista = await _repo.ObtenerTodosAsync(_contexto.NegocioId.Value, incluirInactivos);
            return Ok(lista.Select(MapearDto));
        }

        // GET api/servicios/{id}
        [HttpGet("{id:guid}")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.Empleado},{Roles.SuperAdmin}")]
        public async Task<IActionResult> ObtenerPorId(Guid id)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var servicio = await _repo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (servicio is null) return NotFound(new { mensaje = "Servicio no encontrado" });

            return Ok(MapearDto(servicio));
        }

        // POST api/servicios
        [HttpPost]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
        public async Task<IActionResult> Crear([FromBody] CrearServicioDto dto)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var servicio = new Servicio
            {
                Id = Guid.NewGuid(),
                NegocioId = _contexto.NegocioId.Value,
                CategoriaId = dto.CategoriaId,
                Nombre = dto.Nombre,
                Descripcion = dto.Descripcion,
                DuracionMinutos = dto.DuracionMinutos,
                BufferMinutos = dto.BufferMinutos,
                Precio = dto.Precio,
                Orden = dto.Orden,
                Activo = 1,
                FechaCreacion = DateTime.UtcNow,
                FechaActualizacion = DateTime.UtcNow
            };

            var creado = await _repo.CrearAsync(servicio);
            return CreatedAtAction(nameof(ObtenerPorId), new { id = creado.Id }, MapearDto(creado));
        }

        // PUT api/servicios/{id}
        [HttpPut("{id:guid}")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
        public async Task<IActionResult> Actualizar(Guid id, [FromBody] ActualizarServicioDto dto)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var servicio = await _repo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (servicio is null) return NotFound(new { mensaje = "Servicio no encontrado" });

            servicio.CategoriaId = dto.CategoriaId;
            servicio.Nombre = dto.Nombre;
            servicio.Descripcion = dto.Descripcion;
            servicio.DuracionMinutos = dto.DuracionMinutos;
            servicio.BufferMinutos = dto.BufferMinutos;
            servicio.Precio = dto.Precio;
            servicio.Orden = dto.Orden;
            servicio.Activo = dto.Activo ? 1 : 0;
            servicio.FechaActualizacion = DateTime.UtcNow;

            await _repo.ActualizarAsync(servicio);
            return Ok(MapearDto(servicio));
        }

        // POST api/servicios/{id}/imagen
        [HttpPost("{id:guid}/imagen")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
        public async Task<IActionResult> SubirImagen(Guid id, IFormFile archivo)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            if (archivo is null || archivo.Length == 0)
                return BadRequest(new { mensaje = "No se recibió ningún archivo." });

            var servicio = await _repo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (servicio is null) return NotFound(new { mensaje = "Servicio no encontrado" });

            try
            {
                var url = await _storage.SubirImagenAsync(archivo, "servicios/imagenes");
                servicio.ImagenUrl = url;
                servicio.FechaActualizacion = DateTime.UtcNow;
                await _repo.ActualizarAsync(servicio);
                return Ok(MapearDto(servicio));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { mensaje = ex.Message });
            }
        }

        // DELETE api/servicios/{id}
        [HttpDelete("{id:guid}")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
        public async Task<IActionResult> Eliminar(Guid id)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var servicio = await _repo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (servicio is null) return NotFound(new { mensaje = "Servicio no encontrado" });

            await _repo.EliminarAsync(id, _contexto.NegocioId.Value);
            return NoContent();
        }

        private static ServicioDto MapearDto(Servicio s) => new()
        {
            Id = s.Id,
            NegocioId = s.NegocioId,
            CategoriaId = s.CategoriaId,
            CategoriaNombre = s.Categoria?.Nombre,
            Nombre = s.Nombre,
            Descripcion = s.Descripcion,
            DuracionMinutos = s.DuracionMinutos,
            BufferMinutos = s.BufferMinutos,
            Precio = s.Precio,
            ImagenUrl = s.ImagenUrl,
            Orden = s.Orden,
            Activo = s.Activo == 1
        };
    }
}
