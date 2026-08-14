using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Controllers.V1
{
    [Authorize]
    [ApiController]
    [Route("api/v1/encuesta")]
    public class EncuestaController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IContextoNegocio _contexto;

        public EncuestaController(ApplicationDbContext db, IContextoNegocio contexto)
        {
            _db = db;
            _contexto = contexto;
        }

        // GET api/v1/encuesta/estado — returns whether the satisfaction modal should be shown
        [HttpGet("estado")]
        public async Task<IActionResult> ObtenerEstado()
        {
            if (_contexto.NegocioId is null) return Unauthorized();
            if (_contexto.Rol != "Propietario") return Ok(new { mostrar = false });

            var negocioId = _contexto.NegocioId.Value;

            var encuesta = await _db.EncuestasNegocio
                .FirstOrDefaultAsync(e => e.NegocioId == negocioId);

            if (encuesta != null)
            {
                if (encuesta.Estado is "Respondida" or "Rechazada")
                    return Ok(new { mostrar = false });

                if (encuesta.Estado == "Pospuesta" && encuesta.FechaProximoRecordatorio > DateTime.UtcNow)
                    return Ok(new { mostrar = false });

                return Ok(new { mostrar = true });
            }

            var citasCompletadas = await _db.Citas
                .CountAsync(c => c.NegocioId == negocioId && c.Estado == EstadosCitas.Completada);

            if (citasCompletadas < 40)
                return Ok(new { mostrar = false });

            _db.EncuestasNegocio.Add(new EncuestaNegocio
            {
                Id = Guid.NewGuid(),
                NegocioId = negocioId,
                Estado = "Pendiente",
                FechaCreacion = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();

            return Ok(new { mostrar = true });
        }

        // POST api/v1/encuesta/responder
        [HttpPost("responder")]
        public async Task<IActionResult> Responder([FromBody] ResponderEncuestaDto dto)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var encuesta = await _db.EncuestasNegocio
                .FirstOrDefaultAsync(e => e.NegocioId == _contexto.NegocioId.Value);

            if (encuesta is null) return NotFound();
            if (encuesta.Estado is "Respondida" or "Rechazada") return Conflict();

            encuesta.Rating = dto.Rating;
            encuesta.Comentario = dto.Comentario?.Trim();
            encuesta.Estado = "Respondida";
            encuesta.FechaRespuesta = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return Ok(new { mensaje = "¡Gracias por tu valoración!" });
        }

        // POST api/v1/encuesta/posponer — snoozes the modal for 7 days
        [HttpPost("posponer")]
        public async Task<IActionResult> Posponer()
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var encuesta = await _db.EncuestasNegocio
                .FirstOrDefaultAsync(e => e.NegocioId == _contexto.NegocioId.Value);

            if (encuesta is null) return NotFound();

            encuesta.Estado = "Pospuesta";
            encuesta.FechaProximoRecordatorio = DateTime.UtcNow.AddDays(7);

            await _db.SaveChangesAsync();
            return Ok();
        }

        // POST api/v1/encuesta/rechazar — dismisses permanently
        [HttpPost("rechazar")]
        public async Task<IActionResult> Rechazar()
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var encuesta = await _db.EncuestasNegocio
                .FirstOrDefaultAsync(e => e.NegocioId == _contexto.NegocioId.Value);

            if (encuesta is null) return NotFound();

            encuesta.Estado = "Rechazada";

            await _db.SaveChangesAsync();
            return Ok();
        }
    }

    public class ResponderEncuestaDto
    {
        [Required, Range(1, 5)]
        public byte Rating { get; set; }

        [MaxLength(1000)]
        public string? Comentario { get; set; }
    }
}
