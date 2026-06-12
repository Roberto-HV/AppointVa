using AppointVaAPI.Constants;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Empleados;
using AppointVaAPI.Repository.IRepository;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    [Route("api/empleados")]
    [Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
    public class EmpleadosController : ControllerBase
    {
        private readonly IEmpleadoRepository _repo;
        private readonly IContextoNegocio _contexto;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IBlobStorageService _storage;

        public EmpleadosController(
            IEmpleadoRepository repo,
            IContextoNegocio contexto,
            UserManager<ApplicationUser> userManager,
            IBlobStorageService storage)
        {
            _repo = repo;
            _contexto = contexto;
            _userManager = userManager;
            _storage = storage;
        }

        // GET api/empleados
        [HttpGet]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.Empleado},{Roles.SuperAdmin}")]
        public async Task<IActionResult> ObtenerTodos([FromQuery] bool incluirInactivos = false)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var lista = await _repo.ObtenerTodosAsync(_contexto.NegocioId.Value, incluirInactivos);

            var serviciosPorEmpleado = await _repo.ObtenerServicioIdsBatchAsync(lista.Select(e => e.Id));

            var dtos = lista.Select(e => MapearDto(e, serviciosPorEmpleado.GetValueOrDefault(e.Id, [])));

            return Ok(dtos);
        }

        // GET api/empleados/{id}
        [HttpGet("{id:guid}")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.Empleado},{Roles.SuperAdmin}")]
        public async Task<IActionResult> ObtenerPorId(Guid id)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var empleado = await _repo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (empleado is null) return NotFound(new { mensaje = "Empleado no encontrado" });

            var servicioIds = await _repo.ObtenerServicioIdsAsync(empleado.Id);
            return Ok(MapearDto(empleado, servicioIds));
        }

        // POST api/empleados
        [HttpPost]
        public async Task<IActionResult> Crear([FromBody] CrearEmpleadoDto dto)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var empleado = new Empleado
            {
                Id = Guid.NewGuid(),
                NegocioId = _contexto.NegocioId.Value,
                Nombre = dto.Nombre,
                Telefono = dto.Telefono,
                Email = dto.Email,
                Biografia = dto.Biografia,
                Activo = 1,
                FechaCreacion = DateTime.UtcNow,
                FechaActualizacion = DateTime.UtcNow
            };

            var creado = await _repo.CrearAsync(empleado);

            if (dto.ServicioIds.Count > 0)
                await _repo.ActualizarServiciosAsync(creado.Id, dto.ServicioIds);

            return CreatedAtAction(nameof(ObtenerPorId), new { id = creado.Id },
                MapearDto(creado, dto.ServicioIds));
        }

        // PUT api/empleados/{id}
        [HttpPut("{id:guid}")]
        public async Task<IActionResult> Actualizar(Guid id, [FromBody] CrearEmpleadoDto dto)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var empleado = await _repo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (empleado is null) return NotFound(new { mensaje = "Empleado no encontrado" });

            empleado.Nombre = dto.Nombre;
            empleado.Telefono = dto.Telefono;
            empleado.Email = dto.Email;
            empleado.Biografia = dto.Biografia;
            empleado.FechaActualizacion = DateTime.UtcNow;

            await _repo.ActualizarAsync(empleado);
            await _repo.ActualizarServiciosAsync(empleado.Id, dto.ServicioIds);

            return Ok(MapearDto(empleado, dto.ServicioIds));
        }

        // DELETE api/empleados/{id}
        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Eliminar(Guid id)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var empleado = await _repo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (empleado is null) return NotFound(new { mensaje = "Empleado no encontrado" });

            await _repo.EliminarAsync(id, _contexto.NegocioId.Value);
            return NoContent();
        }

        // ── Horarios ───────────────────────────────────────────────────────────

        // GET api/empleados/{id}/horario
        [HttpGet("{id:guid}/horario")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.Empleado},{Roles.SuperAdmin}")]
        public async Task<IActionResult> ObtenerHorario(Guid id)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var horarios = await _repo.ObtenerHorariosAsync(id, _contexto.NegocioId.Value);
            return Ok(horarios.Select(h => new HorarioDto
            {
                Id = h.Id,
                DiaSemana = h.DiaSemana,
                HoraInicio = h.HoraInicio.ToString(@"hh\:mm"),
                HoraFin = h.HoraFin.ToString(@"hh\:mm"),
                Activo = h.Activo == 1
            }));
        }

        // PUT api/empleados/{id}/horario
        [HttpPut("{id:guid}/horario")]
        public async Task<IActionResult> ActualizarHorario(Guid id, [FromBody] List<HorarioDto> dtos)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var empleado = await _repo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (empleado is null) return NotFound(new { mensaje = "Empleado no encontrado" });

            foreach (var dto in dtos.Where(d => d.Activo))
            {
                var ini = TimeSpan.Parse(dto.HoraInicio);
                var fin = TimeSpan.Parse(dto.HoraFin);
                if (fin <= ini)
                    return BadRequest(new { mensaje = $"La hora de fin del {(DayOfWeek)(byte)dto.DiaSemana} debe ser posterior a la de inicio" });
            }

            var horarios = dtos.Select(dto => new HorarioEmpleado
            {
                Id = dto.Id ?? Guid.NewGuid(),
                EmpleadoId = id,
                DiaSemana = dto.DiaSemana,
                HoraInicio = TimeSpan.Parse(dto.HoraInicio),
                HoraFin = TimeSpan.Parse(dto.HoraFin),
                Activo = dto.Activo ? 1 : 0
            }).ToList();

            await _repo.ActualizarHorariosAsync(id, _contexto.NegocioId.Value, horarios);
            return Ok(new { mensaje = "Horario actualizado correctamente" });
        }

        // ── Bloqueos ───────────────────────────────────────────────────────────

        // GET api/empleados/{id}/bloqueo
        [HttpGet("{id:guid}/bloqueo")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.Empleado},{Roles.SuperAdmin}")]
        public async Task<IActionResult> ObtenerBloqueos(Guid id)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var bloqueos = await _repo.ObtenerBloqueosAsync(id, _contexto.NegocioId.Value);
            return Ok(bloqueos.Select(b => new BloqueoHorarioDto
            {
                Id = b.Id,
                InicioEn = b.InicioEn,
                FinEn = b.FinEn,
                Motivo = b.Motivo
            }));
        }

        // POST api/empleados/{id}/bloqueo
        [HttpPost("{id:guid}/bloqueo")]
        public async Task<IActionResult> CrearBloqueo(Guid id, [FromBody] BloqueoHorarioDto dto)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var empleado = await _repo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (empleado is null) return NotFound(new { mensaje = "Empleado no encontrado" });

            if (dto.FinEn <= dto.InicioEn)
                return BadRequest(new { mensaje = "La fecha de fin debe ser posterior a la de inicio" });

            var bloqueo = new BloqueoHorario
            {
                Id = Guid.NewGuid(),
                EmpleadoId = id,
                InicioEn = dto.InicioEn.ToUniversalTime(),
                FinEn = dto.FinEn.ToUniversalTime(),
                Motivo = dto.Motivo,
                FechaCreacion = DateTime.UtcNow
            };

            var creado = await _repo.CrearBloqueoAsync(bloqueo);
            return CreatedAtAction(nameof(ObtenerBloqueos), new { id },
                new BloqueoHorarioDto { Id = creado.Id, InicioEn = creado.InicioEn, FinEn = creado.FinEn, Motivo = creado.Motivo });
        }

        // DELETE api/empleados/{id}/bloqueo/{bloqueoId}
        [HttpDelete("{id:guid}/bloqueo/{bloqueoId:guid}")]
        public async Task<IActionResult> EliminarBloqueo(Guid id, Guid bloqueoId)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            await _repo.EliminarBloqueoAsync(bloqueoId, _contexto.NegocioId.Value);
            return NoContent();
        }

        // ── Invitación de empleado ─────────────────────────────────────────────
        // POST api/empleados/{id}/invitar — crea cuenta de usuario para el empleado
        [HttpPost("{id:guid}/invitar")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> Invitar(Guid id, [FromBody] InvitarEmpleadoDto dto)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var empleado = await _repo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (empleado is null) return NotFound(new { mensaje = "Empleado no encontrado" });

            if (empleado.UsuarioId is not null)
                return Conflict(new { mensaje = "El empleado ya tiene una cuenta de acceso" });

            var usuarioExistente = await _userManager.FindByEmailAsync(dto.Email);
            if (usuarioExistente is not null)
                return Conflict(new { mensaje = "El correo ya está registrado en el sistema" });

            var partes = empleado.Nombre.Split(' ', 2);
            var nuevoUsuario = new ApplicationUser
            {
                UserName = dto.Email,
                Email = dto.Email,
                NegocioId = _contexto.NegocioId.Value,
                Nombre = partes[0],
                Apellido = partes.Length > 1 ? partes[1] : string.Empty,
                EmailConfirmed = true,
                Activo = true,
                FechaCreacion = DateTime.UtcNow,
                FechaActualizacion = DateTime.UtcNow
            };

            var resultado = await _userManager.CreateAsync(nuevoUsuario, dto.Password);
            if (!resultado.Succeeded)
                return BadRequest(new { errores = resultado.Errors.Select(e => e.Description) });

            await _userManager.AddToRoleAsync(nuevoUsuario, Roles.Empleado);

            // Vincular el usuario al registro de empleado
            empleado.UsuarioId = nuevoUsuario.Id;
            empleado.Email = dto.Email;
            empleado.FechaActualizacion = DateTime.UtcNow;
            await _repo.ActualizarAsync(empleado);

            var servicioIds = await _repo.ObtenerServicioIdsAsync(empleado.Id);
            return Ok(new
            {
                mensaje = "Cuenta creada exitosamente",
                empleado = MapearDto(empleado, servicioIds)
            });
        }

        // DELETE api/empleados/{id}/invitar — revoca el acceso del empleado
        [HttpDelete("{id:guid}/invitar")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> RevocarAcceso(Guid id)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var empleado = await _repo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (empleado is null) return NotFound(new { mensaje = "Empleado no encontrado" });

            if (empleado.UsuarioId is null)
                return BadRequest(new { mensaje = "El empleado no tiene cuenta de acceso" });

            var usuario = await _userManager.FindByIdAsync(empleado.UsuarioId.Value.ToString());
            if (usuario is not null)
                await _userManager.DeleteAsync(usuario);

            empleado.UsuarioId = null;
            empleado.FechaActualizacion = DateTime.UtcNow;
            await _repo.ActualizarAsync(empleado);

            return NoContent();
        }

        // ── Foto del empleado ──────────────────────────────────────────────────
        // POST api/empleados/{id}/foto
        [HttpPost("{id:guid}/foto")]
        public async Task<IActionResult> SubirFoto(Guid id, IFormFile archivo)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            if (archivo is null || archivo.Length == 0)
                return BadRequest(new { mensaje = "No se recibió ningún archivo." });

            var empleado = await _repo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (empleado is null) return NotFound(new { mensaje = "Empleado no encontrado" });

            try
            {
                var url = await _storage.SubirImagenAsync(archivo, "empleados/fotos");
                empleado.FotoUrl = url;
                empleado.FechaActualizacion = DateTime.UtcNow;
                await _repo.ActualizarAsync(empleado);

                var servicioIds = await _repo.ObtenerServicioIdsAsync(empleado.Id);
                return Ok(MapearDto(empleado, servicioIds));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { mensaje = ex.Message });
            }
        }

        private static EmpleadoDto MapearDto(Empleado e, List<Guid> servicioIds) => new()
        {
            Id = e.Id,
            Nombre = e.Nombre,
            Telefono = e.Telefono,
            Email = e.Email,
            FotoUrl = e.FotoUrl,
            Biografia = e.Biografia,
            Activo = e.Activo == 1,
            ServicioIds = servicioIds
        };
    }
}
