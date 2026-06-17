using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Negocios;
using AppointVaAPI.Repository.IRepository;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    [Route("api/negocios")]
    [Authorize]
    public class NegociosController : ControllerBase
    {
        private readonly INegocioRepository _repo;
        private readonly IContextoNegocio _contexto;
        private readonly IBlobStorageService _storage;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ApplicationDbContext _db;

        public NegociosController(
            INegocioRepository repo,
            IContextoNegocio contexto,
            IBlobStorageService storage,
            UserManager<ApplicationUser> userManager,
            ApplicationDbContext db)
        {
            _repo = repo;
            _contexto = contexto;
            _storage = storage;
            _userManager = userManager;
            _db = db;
        }

        // GET api/negocios/perfil — el propietario ve su propio negocio
        [HttpGet("perfil")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.Empleado}")]
        public async Task<IActionResult> ObtenerPerfil()
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var negocio = await _repo.ObtenerPorIdAsync(_contexto.NegocioId.Value);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            return Ok(MapearDto(negocio));
        }

        // PUT api/negocios/perfil — el propietario actualiza su negocio
        [HttpPut("perfil")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> ActualizarPerfil([FromBody] ActualizarNegocioDto dto)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var negocio = await _repo.ObtenerPorIdAsync(_contexto.NegocioId.Value);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            negocio.Nombre = dto.Nombre;
            negocio.Telefono = dto.Telefono;
            negocio.Email = dto.Email;
            negocio.Direccion = dto.Direccion;
            negocio.Descripcion = dto.Descripcion;
            if (!string.IsNullOrWhiteSpace(dto.ZonaHoraria))
                negocio.ZonaHoraria = dto.ZonaHoraria;
            if (dto.HorasRecordatorio.HasValue && dto.HorasRecordatorio.Value > 0)
                negocio.HorasRecordatorio = dto.HorasRecordatorio.Value;
            if (dto.HorasCancelacion.HasValue)
                negocio.HorasCancelacion = Math.Max(0, dto.HorasCancelacion.Value);
            if (dto.AutoConfirmar.HasValue)
                negocio.AutoConfirmar = dto.AutoConfirmar.Value;
            if (!string.IsNullOrWhiteSpace(dto.MetodoNotificacion))
                negocio.MetodoNotificacion = dto.MetodoNotificacion;
            negocio.TelefonoWhatsApp = dto.TelefonoWhatsApp;
            if (dto.RequiereAnticipo.HasValue)
                negocio.RequiereAnticipo = dto.RequiereAnticipo.Value;
            if (dto.MontoAnticipo.HasValue)
                negocio.MontoAnticipo = Math.Max(0, dto.MontoAnticipo.Value);
            negocio.InstruccionesAnticipo = dto.InstruccionesAnticipo;
            negocio.FechaActualizacion = DateTime.UtcNow;

            await _repo.ActualizarAsync(negocio);
            return Ok(MapearDto(negocio));
        }

        // PATCH api/negocios/perfil/colores — el propietario actualiza los colores de su propio negocio
        [HttpPatch("perfil/colores")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> ActualizarColoresPerfil([FromBody] ActualizarColoresNegocioDto dto)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var negocio = await _repo.ObtenerPorIdAsync(_contexto.NegocioId.Value);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            if (!string.IsNullOrWhiteSpace(dto.ColorPrimario))
                negocio.ColorPrimario = dto.ColorPrimario;
            if (!string.IsNullOrWhiteSpace(dto.ColorSecundario))
                negocio.ColorSecundario = dto.ColorSecundario;
            negocio.FechaActualizacion = DateTime.UtcNow;

            await _repo.ActualizarAsync(negocio);
            return Ok(MapearDto(negocio));
        }

        // ── Super-admin: listado y creación de negocios ────────────────────────

        // PATCH api/negocios/{id}/colores — super-admin actualiza los colores de un negocio
        [HttpPatch("{id:guid}/colores")]
        [Authorize(Roles = Roles.SuperAdmin)]
        public async Task<IActionResult> ActualizarColores(Guid id, [FromBody] ActualizarColoresNegocioDto dto)
        {
            var negocio = await _repo.ObtenerPorIdAsync(id);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            negocio.ColorPrimario = string.IsNullOrWhiteSpace(dto.ColorPrimario) ? null : dto.ColorPrimario;
            negocio.ColorSecundario = string.IsNullOrWhiteSpace(dto.ColorSecundario) ? null : dto.ColorSecundario;
            negocio.FechaActualizacion = DateTime.UtcNow;

            await _repo.ActualizarAsync(negocio);
            return Ok(MapearDto(negocio));
        }

        // GET api/negocios — super-admin ve todos los negocios
        [HttpGet]
        [Authorize(Roles = Roles.SuperAdmin)]
        public async Task<IActionResult> ObtenerTodos()
        {
            var lista = await _repo.ObtenerTodosAsync();
            return Ok(lista.Select(MapearDto));
        }

        // POST api/negocios — super-admin crea un nuevo negocio
        [HttpPost]
        [Authorize(Roles = Roles.SuperAdmin)]
        public async Task<IActionResult> Crear([FromBody] CrearNegocioDto dto)
        {
            if (await _repo.SlugExisteAsync(dto.Slug))
                return Conflict(new { mensaje = "El slug ya está en uso" });

            var negocio = new Negocio
            {
                Id = Guid.NewGuid(),
                Slug = dto.Slug.ToLowerInvariant(),
                Nombre = dto.Nombre,
                Telefono = dto.Telefono,
                Email = dto.Email,
                Descripcion = dto.Descripcion,
                PlanId = dto.PlanId,
                Activo = 1,
                FechaCreacion = DateTime.UtcNow,
                FechaActualizacion = DateTime.UtcNow
            };

            var creado = await _repo.CrearAsync(negocio);
            return CreatedAtAction(nameof(ObtenerPorId), new { id = creado.Id }, MapearDto(creado));
        }

        // GET api/negocios/{id} — super-admin ve un negocio específico
        [HttpGet("{id:guid}")]
        [Authorize(Roles = Roles.SuperAdmin)]
        public async Task<IActionResult> ObtenerPorId(Guid id)
        {
            var negocio = await _repo.ObtenerPorIdAsync(id);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            return Ok(MapearDto(negocio));
        }

        // PATCH api/negocios/{id}/activar — super-admin activa un negocio
        [HttpPatch("{id:guid}/activar")]
        [Authorize(Roles = Roles.SuperAdmin)]
        public async Task<IActionResult> Activar(Guid id)
        {
            var negocio = await _repo.ObtenerPorIdAsync(id);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            negocio.Activo = 1;
            negocio.FechaActualizacion = DateTime.UtcNow;
            await _repo.ActualizarAsync(negocio);
            return Ok(MapearDto(negocio));
        }

        // PATCH api/negocios/{id}/desactivar — super-admin desactiva un negocio
        [HttpPatch("{id:guid}/desactivar")]
        [Authorize(Roles = Roles.SuperAdmin)]
        public async Task<IActionResult> Desactivar(Guid id)
        {
            var negocio = await _repo.ObtenerPorIdAsync(id);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            negocio.Activo = 0;
            negocio.FechaActualizacion = DateTime.UtcNow;
            await _repo.ActualizarAsync(negocio);
            return Ok(MapearDto(negocio));
        }

        // DELETE api/negocios/{id} — super-admin elimina un negocio (soft delete)
        [HttpDelete("{id:guid}")]
        [Authorize(Roles = Roles.SuperAdmin)]
        public async Task<IActionResult> Eliminar(Guid id)
        {
            var negocio = await _repo.ObtenerPorIdAsync(id);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            await _repo.EliminarAsync(negocio);
            return NoContent();
        }

        // ── Propietario ────────────────────────────────────────────────────────

        // POST api/negocios/{id}/propietario — super-admin crea el propietario de un negocio
        [HttpPost("{id:guid}/propietario")]
        [Authorize(Roles = Roles.SuperAdmin)]
        public async Task<IActionResult> CrearPropietario(Guid id, [FromBody] CrearPropietarioDto dto)
        {
            var negocio = await _repo.ObtenerPorIdAsync(id);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            var usuarioExistente = await _userManager.FindByEmailAsync(dto.Email);
            if (usuarioExistente is not null)
                return Conflict(new { mensaje = "El correo ya está registrado en el sistema" });

            var propietario = new ApplicationUser
            {
                UserName = dto.Email,
                Email = dto.Email,
                Nombre = dto.Nombre,
                Apellido = dto.Apellido,
                NegocioId = id,
                EmailConfirmed = true,
                Activo = true,
                FechaCreacion = DateTime.UtcNow,
                FechaActualizacion = DateTime.UtcNow
            };

            var resultado = await _userManager.CreateAsync(propietario, dto.Password);
            if (!resultado.Succeeded)
                return BadRequest(new { errores = resultado.Errors.Select(e => e.Description) });

            await _userManager.AddToRoleAsync(propietario, Roles.Propietario);

            return Ok(new
            {
                mensaje = "Propietario creado exitosamente",
                email = dto.Email,
                nombreCompleto = $"{dto.Nombre} {dto.Apellido}".Trim()
            });
        }

        // ── Horarios del negocio ──────────────────────────────────────────────

        // GET api/negocios/perfil/horarios
        [HttpGet("perfil/horarios")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.Empleado}")]
        public async Task<IActionResult> ObtenerHorarios()
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var horarios = await _db.HorariosNegocios
                .Where(h => h.NegocioId == _contexto.NegocioId.Value)
                .OrderBy(h => h.DiaSemana)
                .ToListAsync();

            // Devuelve los 7 días; si no existe un día, lo crea con valores por defecto
            var resultado = Enumerable.Range(0, 7).Select(dia =>
            {
                var h = horarios.FirstOrDefault(x => x.DiaSemana == dia);
                return new
                {
                    id = h?.Id,
                    diaSemana = dia,
                    horaInicio = h != null ? h.HoraInicio.ToString(@"hh\:mm") : "09:00",
                    horaFin = h != null ? h.HoraFin.ToString(@"hh\:mm") : "18:00",
                    activo = h?.Activo == 1
                };
            });

            return Ok(resultado);
        }

        // PUT api/negocios/perfil/horarios
        [HttpPut("perfil/horarios")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> ActualizarHorarios([FromBody] List<ActualizarHorarioNegocioDto> horarios)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var existentes = await _db.HorariosNegocios
                .Where(h => h.NegocioId == _contexto.NegocioId.Value)
                .ToListAsync();

            foreach (var dto in horarios)
            {
                var existente = existentes.FirstOrDefault(h => h.DiaSemana == dto.DiaSemana);
                if (existente is null)
                {
                    _db.HorariosNegocios.Add(new HorarioNegocio
                    {
                        Id = Guid.NewGuid(),
                        NegocioId = _contexto.NegocioId.Value,
                        DiaSemana = dto.DiaSemana,
                        HoraInicio = TimeSpan.Parse(dto.HoraInicio),
                        HoraFin = TimeSpan.Parse(dto.HoraFin),
                        Activo = dto.Activo ? 1 : 0
                    });
                }
                else
                {
                    existente.HoraInicio = TimeSpan.Parse(dto.HoraInicio);
                    existente.HoraFin = TimeSpan.Parse(dto.HoraFin);
                    existente.Activo = dto.Activo ? 1 : 0;
                    _db.HorariosNegocios.Update(existente);
                }
            }

            await _db.SaveChangesAsync();
            return await ObtenerHorarios();
        }

        // ── Imágenes del negocio ───────────────────────────────────────────────

        // POST api/negocios/perfil/logo
        [HttpPost("perfil/logo")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> SubirLogo(IFormFile archivo)
        {
            if (_contexto.NegocioId is null) return Unauthorized();
            return await SubirImagenNegocioAsync(_contexto.NegocioId.Value, archivo, "logo");
        }

        // POST api/negocios/perfil/portada
        [HttpPost("perfil/portada")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> SubirPortada(IFormFile archivo)
        {
            if (_contexto.NegocioId is null) return Unauthorized();
            return await SubirImagenNegocioAsync(_contexto.NegocioId.Value, archivo, "portada");
        }

        private async Task<IActionResult> SubirImagenNegocioAsync(Guid negocioId, IFormFile archivo, string tipo)
        {
            if (archivo is null || archivo.Length == 0)
                return BadRequest(new { mensaje = "No se recibió ningún archivo." });

            var negocio = await _repo.ObtenerPorIdAsync(negocioId);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            try
            {
                var url = await _storage.SubirImagenAsync(archivo, $"negocios/{tipo}s");

                if (tipo == "logo")
                    negocio.LogoUrl = url;
                else
                    negocio.PortadaUrl = url;

                negocio.FechaActualizacion = DateTime.UtcNow;
                await _repo.ActualizarAsync(negocio);

                return Ok(new { url });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { mensaje = ex.Message });
            }
        }

        // ── Galería de imágenes ───────────────────────────────────────────────────

        // GET api/negocios/galeria
        [HttpGet("galeria")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> ObtenerGaleria()
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var imagenes = await _db.ImagenesNegocios
                .Where(i => i.NegocioId == _contexto.NegocioId.Value)
                .OrderBy(i => i.Orden)
                .Select(i => new { i.Id, i.Url, i.Descripcion, i.Orden, i.FechaCreacion })
                .AsNoTracking()
                .ToListAsync();

            return Ok(imagenes);
        }

        // POST api/negocios/galeria
        [HttpPost("galeria")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> SubirImagenGaleria(IFormFile archivo, [FromForm] string? descripcion)
        {
            if (_contexto.NegocioId is null) return Unauthorized();
            if (archivo is null || archivo.Length == 0)
                return BadRequest(new { mensaje = "No se recibió ningún archivo." });

            var total = await _db.ImagenesNegocios
                .CountAsync(i => i.NegocioId == _contexto.NegocioId.Value);
            if (total >= 20)
                return BadRequest(new { mensaje = "Máximo 20 imágenes en la galería." });

            try
            {
                var url = await _storage.SubirImagenAsync(archivo, "negocios/galeria");
                var imagen = new ImagenNegocio
                {
                    Id = Guid.NewGuid(),
                    NegocioId = _contexto.NegocioId.Value,
                    Url = url,
                    Descripcion = string.IsNullOrWhiteSpace(descripcion) ? null : descripcion.Trim(),
                    Orden = total + 1,
                    FechaCreacion = DateTime.UtcNow
                };
                _db.ImagenesNegocios.Add(imagen);
                await _db.SaveChangesAsync();
                return Ok(new { imagen.Id, imagen.Url, imagen.Descripcion, imagen.Orden, imagen.FechaCreacion });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { mensaje = ex.Message });
            }
        }

        // DELETE api/negocios/galeria/{id}
        [HttpDelete("galeria/{id:guid}")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> EliminarImagenGaleria(Guid id)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var imagen = await _db.ImagenesNegocios
                .FirstOrDefaultAsync(i => i.Id == id && i.NegocioId == _contexto.NegocioId.Value);
            if (imagen is null) return NotFound();

            _db.ImagenesNegocios.Remove(imagen);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ── Días bloqueados del negocio ───────────────────────────────────────────

        // GET api/negocios/dias-bloqueados
        [HttpGet("dias-bloqueados")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.Empleado}")]
        public async Task<IActionResult> ObtenerDiasBloqueados()
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var bloqueos = await _db.BloqueosNegocio
                .Where(b => b.NegocioId == _contexto.NegocioId.Value && b.Fecha >= DateTime.UtcNow.Date)
                .OrderBy(b => b.Fecha)
                .Select(b => new BloqueoNegocioDto
                {
                    Id = b.Id,
                    Fecha = b.Fecha.ToString("yyyy-MM-dd"),
                    Motivo = b.Motivo
                })
                .ToListAsync();

            return Ok(bloqueos);
        }

        // POST api/negocios/dias-bloqueados
        [HttpPost("dias-bloqueados")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> BloquearDia([FromBody] CrearBloqueoNegocioDto dto)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var fechaDate = dto.Fecha.Date;

            var yaExiste = await _db.BloqueosNegocio
                .AnyAsync(b => b.NegocioId == _contexto.NegocioId.Value && b.Fecha.Date == fechaDate);

            if (yaExiste)
                return Conflict(new { mensaje = "Este día ya está bloqueado" });

            var bloqueo = new BloqueoNegocio
            {
                Id = Guid.NewGuid(),
                NegocioId = _contexto.NegocioId.Value,
                Fecha = fechaDate,
                Motivo = string.IsNullOrWhiteSpace(dto.Motivo) ? null : dto.Motivo.Trim(),
                FechaCreacion = DateTime.UtcNow
            };

            _db.BloqueosNegocio.Add(bloqueo);
            await _db.SaveChangesAsync();

            return Ok(new BloqueoNegocioDto
            {
                Id = bloqueo.Id,
                Fecha = bloqueo.Fecha.ToString("yyyy-MM-dd"),
                Motivo = bloqueo.Motivo
            });
        }

        // DELETE api/negocios/dias-bloqueados/{id}
        [HttpDelete("dias-bloqueados/{id:guid}")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> DesbloquearDia(Guid id)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var bloqueo = await _db.BloqueosNegocio
                .FirstOrDefaultAsync(b => b.Id == id && b.NegocioId == _contexto.NegocioId.Value);

            if (bloqueo is null) return NotFound();

            _db.BloqueosNegocio.Remove(bloqueo);
            await _db.SaveChangesAsync();

            return NoContent();
        }

        private static NegocioDto MapearDto(Negocio n) => new()
        {
            Id = n.Id,
            Slug = n.Slug,
            Nombre = n.Nombre,
            Telefono = n.Telefono,
            Email = n.Email,
            Direccion = n.Direccion,
            Descripcion = n.Descripcion,
            LogoUrl = n.LogoUrl,
            PortadaUrl = n.PortadaUrl,
            ColorPrimario = n.ColorPrimario,
            ColorSecundario = n.ColorSecundario,
            ZonaHoraria = n.ZonaHoraria,
            Moneda = n.Moneda,
            HorasRecordatorio = n.HorasRecordatorio,
            HorasCancelacion = n.HorasCancelacion,
            AutoConfirmar = n.AutoConfirmar,
            MetodoNotificacion = n.MetodoNotificacion,
            TelefonoWhatsApp = n.TelefonoWhatsApp,
            RequiereAnticipo = n.RequiereAnticipo,
            MontoAnticipo = n.MontoAnticipo,
            InstruccionesAnticipo = n.InstruccionesAnticipo,
            Activo = n.Activo == 1,
            PlanNombre = n.Plan?.Nombre
        };
    }
}
