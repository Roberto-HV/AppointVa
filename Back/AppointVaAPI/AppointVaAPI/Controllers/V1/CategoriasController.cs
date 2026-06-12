using AppointVaAPI.Constants;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Categorias;
using AppointVaAPI.Repository.IRepository;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    [Route("api/categorias")]
    [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
    public class CategoriasController : ControllerBase
    {
        private readonly ICategoriaRepository _repo;
        private readonly IContextoNegocio _contexto;

        public CategoriasController(ICategoriaRepository repo, IContextoNegocio contexto)
        {
            _repo = repo;
            _contexto = contexto;
        }

        // GET api/categorias
        [HttpGet]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.Empleado},{Roles.SuperAdmin}")]
        public async Task<IActionResult> ObtenerTodos()
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var lista = await _repo.ObtenerTodosAsync(_contexto.NegocioId.Value);
            return Ok(lista.Select(MapearDto));
        }

        // GET api/categorias/{id}
        [HttpGet("{id:guid}")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.Empleado},{Roles.SuperAdmin}")]
        public async Task<IActionResult> ObtenerPorId(Guid id)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var categoria = await _repo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (categoria is null) return NotFound(new { mensaje = "Categoría no encontrada" });

            return Ok(MapearDto(categoria));
        }

        // POST api/categorias
        [HttpPost]
        public async Task<IActionResult> Crear([FromBody] CrearCategoriaDto dto)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var categoria = new CategoriaServicio
            {
                Id = Guid.NewGuid(),
                NegocioId = _contexto.NegocioId.Value,
                Nombre = dto.Nombre,
                Orden = dto.Orden,
                Activo = 1
            };

            var creada = await _repo.CrearAsync(categoria);
            return CreatedAtAction(nameof(ObtenerPorId), new { id = creada.Id }, MapearDto(creada));
        }

        // PUT api/categorias/{id}
        [HttpPut("{id:guid}")]
        public async Task<IActionResult> Actualizar(Guid id, [FromBody] CrearCategoriaDto dto)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var categoria = await _repo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (categoria is null) return NotFound(new { mensaje = "Categoría no encontrada" });

            categoria.Nombre = dto.Nombre;
            categoria.Orden = dto.Orden;

            await _repo.ActualizarAsync(categoria);
            return Ok(MapearDto(categoria));
        }

        // DELETE api/categorias/{id}
        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Eliminar(Guid id)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var categoria = await _repo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (categoria is null) return NotFound(new { mensaje = "Categoría no encontrada" });

            await _repo.EliminarAsync(id, _contexto.NegocioId.Value);
            return NoContent();
        }

        private static CategoriaDto MapearDto(CategoriaServicio c) => new()
        {
            Id = c.Id,
            Nombre = c.Nombre,
            Orden = c.Orden,
            Activo = c.Activo == 1
        };
    }
}
