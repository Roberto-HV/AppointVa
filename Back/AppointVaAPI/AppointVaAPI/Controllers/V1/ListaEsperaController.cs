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
    public class ListaEsperaController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IContextoNegocio _contexto;

        public ListaEsperaController(ApplicationDbContext db, IContextoNegocio contexto)
        {
            _db = db;
            _contexto = contexto;
        }

        // GET /api/lista-espera — propietario ve su lista
        [HttpGet("api/lista-espera")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
        public async Task<IActionResult> GetLista([FromQuery] string? estado)
        {
            var negocioId = _contexto.NegocioId;
            if (negocioId == null || negocioId == Guid.Empty) return Unauthorized();

            var query = _db.ListaEspera
                .Where(le => le.NegocioId == negocioId)
                .AsQueryable();

            if (!string.IsNullOrEmpty(estado))
                query = query.Where(le => le.Estado == estado);

            var lista = await query
                .OrderByDescending(le => le.FechaCreacion)
                .Select(le => new {
                    le.Id,
                    le.NombreCliente,
                    le.TelefonoCliente,
                    le.EmailCliente,
                    le.FechaPreferida,
                    le.Estado,
                    le.FechaCreacion,
                    le.FechaNotificacion,
                    servicioNombre = le.Servicio != null ? le.Servicio.Nombre : null,
                    empleadoNombre = le.Empleado != null ? le.Empleado.Nombre : null,
                })
                .ToListAsync();

            return Ok(lista);
        }

        // DELETE /api/lista-espera/{id}
        [HttpDelete("api/lista-espera/{id:guid}")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
        public async Task<IActionResult> Eliminar(Guid id)
        {
            var negocioId = _contexto.NegocioId;
            if (negocioId == null) return Unauthorized();
            var entrada = await _db.ListaEspera.FirstOrDefaultAsync(le => le.Id == id && le.NegocioId == negocioId);
            if (entrada == null) return NotFound();
            _db.ListaEspera.Remove(entrada);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // PATCH /api/lista-espera/{id}/estado
        [HttpPatch("api/lista-espera/{id:guid}/estado")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
        public async Task<IActionResult> CambiarEstado(Guid id, [FromBody] CambiarEstadoDto dto)
        {
            var negocioId = _contexto.NegocioId;
            if (negocioId == null) return Unauthorized();
            var entrada = await _db.ListaEspera.FirstOrDefaultAsync(le => le.Id == id && le.NegocioId == negocioId);
            if (entrada == null) return NotFound();

            var estadosValidos = new[] { "Esperando", "Notificado", "Confirmado", "Expirado" };
            if (!estadosValidos.Contains(dto.Estado)) return BadRequest("Estado inválido");

            entrada.Estado = dto.Estado;
            if (dto.Estado == "Notificado")
                entrada.FechaNotificacion = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return Ok(new { entrada.Id, entrada.Estado, entrada.FechaNotificacion });
        }
    }

    public record CambiarEstadoDto(string Estado);
}
