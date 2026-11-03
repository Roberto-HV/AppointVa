using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Filters;
using AppointVaAPI.Helpers;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Horarios;
using AppointVaAPI.Models.Dtos.Negocios;
using AppointVaAPI.Repository.IRepository;
using AppointVaAPI.Services;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
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
        private readonly RoleManager<IdentityRole<Guid>> _roleManager;
        private readonly ApplicationDbContext _db;
        private readonly IOutputCacheStore _cacheStore;
        private readonly IAuditService _audit;
        private readonly IEmailService _email;
        private readonly IConfiguration _config;

        public NegociosController(
            INegocioRepository repo,
            IContextoNegocio contexto,
            IBlobStorageService storage,
            UserManager<ApplicationUser> userManager,
            RoleManager<IdentityRole<Guid>> roleManager,
            ApplicationDbContext db,
            IOutputCacheStore cacheStore,
            IAuditService audit,
            IEmailService email,
            IConfiguration config)
        {
            _email = email;
            _config = config;
            _repo = repo;
            _contexto = contexto;
            _storage = storage;
            _userManager = userManager;
            _roleManager = roleManager;
            _db = db;
            _cacheStore = cacheStore;
            _audit = audit;
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
            negocio.DiasAnticipacionMinima = dto.DiasAnticipacionMinima ?? negocio.DiasAnticipacionMinima;
            if (dto.AutoConfirmar.HasValue)
                negocio.AutoConfirmar = dto.AutoConfirmar.Value;
            if (dto.ListaEsperaActiva.HasValue)
                negocio.ListaEsperaActiva = dto.ListaEsperaActiva.Value;
            if (!string.IsNullOrWhiteSpace(dto.MetodoNotificacion))
                negocio.MetodoNotificacion = dto.MetodoNotificacion;
            negocio.TelefonoWhatsApp = dto.TelefonoWhatsApp;
            if (dto.RequiereAnticipo.HasValue)
                negocio.RequiereAnticipo = dto.RequiereAnticipo.Value;
            if (dto.MontoAnticipo.HasValue)
                negocio.MontoAnticipo = Math.Max(0, dto.MontoAnticipo.Value);
            negocio.InstruccionesAnticipo = dto.InstruccionesAnticipo;
            if (dto.PorcentajeAnticipo.HasValue)
                negocio.PorcentajeAnticipo = dto.PorcentajeAnticipo.Value;
            if (dto.HorasCancelacionConReembolso.HasValue)
                negocio.HorasCancelacionConReembolso = dto.HorasCancelacionConReembolso.Value;
            if (dto.PoliticaCancelacionAnticipo is not null)
                negocio.PoliticaCancelacionAnticipo = dto.PoliticaCancelacionAnticipo;
            negocio.InstagramUrl = string.IsNullOrWhiteSpace(dto.InstagramUrl) ? null : dto.InstagramUrl.Trim();
            negocio.FacebookUrl = string.IsNullOrWhiteSpace(dto.FacebookUrl) ? null : dto.FacebookUrl.Trim();
            negocio.TiktokUrl = string.IsNullOrWhiteSpace(dto.TiktokUrl) ? null : dto.TiktokUrl.Trim();
            if (!string.IsNullOrWhiteSpace(dto.PortadaObjectPosition))
                negocio.PortadaObjectPosition = dto.PortadaObjectPosition.Trim();
            // Cadena vacía quita el fondo generado; null deja lo guardado como está.
            if (dto.PortadaPreset != null)
                negocio.PortadaPreset = string.IsNullOrWhiteSpace(dto.PortadaPreset) ? null : dto.PortadaPreset.Trim();
            negocio.FechaActualizacion = DateTime.UtcNow;

            await _repo.ActualizarAsync(negocio);
            await _cacheStore.EvictByTagAsync($"negocio-{negocio.Slug}", CancellationToken.None);
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
            await _cacheStore.EvictByTagAsync($"negocio-{negocio.Slug}", CancellationToken.None);
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

            var antes = $"{negocio.ColorPrimario ?? "—"} / {negocio.ColorSecundario ?? "—"}";
            negocio.ColorPrimario = string.IsNullOrWhiteSpace(dto.ColorPrimario) ? null : dto.ColorPrimario;
            negocio.ColorSecundario = string.IsNullOrWhiteSpace(dto.ColorSecundario) ? null : dto.ColorSecundario;
            negocio.FechaActualizacion = DateTime.UtcNow;

            await _repo.ActualizarAsync(negocio);
            await _cacheStore.EvictByTagAsync($"negocio-{negocio.Slug}", CancellationToken.None);
            await _audit.RegistrarNegocioAsync(AccionesAuditoria.ColoresCambiados, negocio.Id,
                $"Primario / secundario: {antes} → {negocio.ColorPrimario ?? "—"} / {negocio.ColorSecundario ?? "—"}");
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

            // Lote 5 (I8): with an owner, everything is checked before anything is written, so a
            // refused request never leaves a business without its owner behind.
            if (dto.Propietario is not null)
            {
                if (!_email.EnvioDisponible) return CorreoNoDisponible();
                if (await _userManager.FindByEmailAsync(dto.Propietario.Email) is not null)
                    return Conflict(new { mensaje = "El correo del propietario ya está registrado en el sistema" });
            }

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

            // Business, owner account and both audit rows commit together; the invitation goes
            // out after the commit (an email cannot be rolled back).
            await using var tx = await _db.Database.BeginTransactionAsync();
            var creado = await _repo.CrearAsync(negocio);
            var plan = creado.PlanId.HasValue
                ? await _db.Planes.Where(p => p.Id == creado.PlanId.Value).Select(p => p.Nombre).FirstOrDefaultAsync()
                : null;
            await _audit.RegistrarNegocioAsync(AccionesAuditoria.NegocioCreado, creado.Id,
                $"Nombre: {creado.Nombre}; Slug: {creado.Slug}; Plan: {plan ?? "sin plan"}" +
                (dto.Propietario is null ? "" : "; con propietario invitado"));

            ApplicationUser? propietario = null;
            if (dto.Propietario is not null)
            {
                var (cuenta, error) = await CrearCuentaPropietarioAsync(creado.Id, dto.Propietario);
                if (error is not null) return error;
                propietario = cuenta;
            }
            await tx.CommitAsync();

            bool? invitacionEnviada = propietario is null
                ? null
                : await EnviarEnlaceAccesoAsync(propietario, esInvitacion: true, creado.Nombre);

            var respuesta = MapearDto<NegocioCreadoDto>(creado);
            respuesta.PropietarioEmail = propietario?.Email;
            respuesta.InvitacionEnviada = invitacionEnviada;
            return CreatedAtAction(nameof(ObtenerPorId), new { id = creado.Id }, respuesta);
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

            var estabaActivo = negocio.Activo == 1;
            negocio.Activo = 1;
            negocio.FechaActualizacion = DateTime.UtcNow;
            await _repo.ActualizarAsync(negocio);
            await _audit.RegistrarNegocioAsync(AccionesAuditoria.NegocioActivado, negocio.Id,
                $"Nombre: {negocio.Nombre}{(estabaActivo ? "; ya estaba activo" : "")}");
            return Ok(MapearDto(negocio));
        }

        // PATCH api/negocios/{id}/confirmar-email — super-admin confirma el email del propietario
        // Mandatory audit: it skips the owner's own verification of the address.
        [HttpPatch("{id:guid}/confirmar-email")]
        [Authorize(Roles = Roles.SuperAdmin)]
        public async Task<IActionResult> ConfirmarEmail(Guid id)
        {
            var propietario = await _db.Users
                .FirstOrDefaultAsync(u => u.NegocioId == id);

            if (propietario is null)
                return NotFound(new { mensaje = "No se encontró el propietario del negocio." });

            if (!propietario.EmailConfirmed)
            {
                await using var tx = await _db.Database.BeginTransactionAsync();
                propietario.EmailConfirmed = true;
                await _userManager.UpdateAsync(propietario);
                if (!await _audit.RegistrarNegocioObligatorioAsync(AccionesAuditoria.CorreoConfirmadoManual, id,
                        $"Usuario: {propietario.Id}"))
                    return AuditoriaAdmin.NoDisponible(this);
                await tx.CommitAsync();
            }

            return Ok(new { mensaje = "Email confirmado correctamente." });
        }

        // PATCH api/negocios/{id}/desactivar — super-admin desactiva un negocio
        [HttpPatch("{id:guid}/desactivar")]
        [Authorize(Roles = Roles.SuperAdmin)]
        public async Task<IActionResult> Desactivar(Guid id)
        {
            var negocio = await _repo.ObtenerPorIdAsync(id);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            var estabaActivo = negocio.Activo == 1;
            negocio.Activo = 0;
            negocio.FechaActualizacion = DateTime.UtcNow;
            await _repo.ActualizarAsync(negocio);
            await _audit.RegistrarNegocioAsync(AccionesAuditoria.NegocioDesactivado, negocio.Id,
                $"Nombre: {negocio.Nombre}{(estabaActivo ? "" : "; ya estaba inactivo")}");
            return Ok(MapearDto(negocio));
        }

        // DELETE api/negocios/{id} — super-admin elimina un negocio (soft delete)
        // Mandatory audit, in the same transaction: the business disappears from every list.
        // Lote 5 (G1): needs the step-up proof, like the hard delete.
        [HttpDelete("{id:guid}")]
        [Authorize(Roles = Roles.SuperAdmin)]
        [RequiereReautenticacion]
        public async Task<IActionResult> Eliminar(Guid id)
        {
            var negocio = await _repo.ObtenerPorIdAsync(id);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            await using var tx = await _db.Database.BeginTransactionAsync();
            await _repo.EliminarAsync(negocio);
            if (!await _audit.RegistrarNegocioObligatorioAsync(AccionesAuditoria.NegocioArchivado, negocio.Id,
                    $"Nombre: {negocio.Nombre}; Slug: {negocio.Slug}"))
                return AuditoriaAdmin.NoDisponible(this);
            await tx.CommitAsync();
            return NoContent();
        }

        // ── Propietario ────────────────────────────────────────────────────────

        // POST api/negocios/{id}/propietario — super-admin crea el propietario de un negocio
        // Lote 5 (I4): by invitation. The account has no password until the owner opens the
        // link and chooses one; the admin never types or sees it.
        [HttpPost("{id:guid}/propietario")]
        [Authorize(Roles = Roles.SuperAdmin)]
        public async Task<IActionResult> CrearPropietario(Guid id, [FromBody] CrearPropietarioDto dto)
        {
            var negocio = await _repo.ObtenerPorIdAsync(id);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            if (!_email.EnvioDisponible) return CorreoNoDisponible();

            var usuarioExistente = await _userManager.FindByEmailAsync(dto.Email);
            if (usuarioExistente is not null)
                return Conflict(new { mensaje = "El correo ya está registrado en el sistema" });

            // Mandatory audit in the same transaction as the account.
            await using var tx = await _db.Database.BeginTransactionAsync();
            var (propietario, error) = await CrearCuentaPropietarioAsync(id, dto);
            if (error is not null) return error;
            await tx.CommitAsync();

            var enviada = await EnviarEnlaceAccesoAsync(propietario!, esInvitacion: true, negocio.Nombre);

            return Ok(new
            {
                mensaje = enviada
                    ? $"Le enviamos a {dto.Email} un enlace para crear su contraseña."
                    : "Creamos la cuenta, pero no pudimos enviar la invitación. Usa \"Enviar enlace\" para intentarlo de nuevo.",
                email = dto.Email,
                nombreCompleto = $"{dto.Nombre} {dto.Apellido}".Trim(),
                invitacionEnviada = enviada
            });
        }

        // POST api/negocios/{id}/propietario/enlace-contrasena — lote 5 (I4)
        // Replaces "the admin types a new password": the owner gets the same reset link as
        // /recuperar-contrasena and chooses the password. The current one keeps working until
        // then. Needs the step-up proof. The audit row is written first, in a transaction that
        // only commits once the provider accepted the email, so a failed send leaves no row.
        [HttpPost("{id:guid}/propietario/enlace-contrasena")]
        [Authorize(Roles = Roles.SuperAdmin)]
        [RequiereReautenticacion]
        public async Task<IActionResult> EnviarEnlaceContrasenaPropietario(Guid id)
        {
            var negocio = await _repo.ObtenerPorIdAsync(id);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            var propietario = await ObtenerPropietarioAsync(id);
            if (propietario is null) return NotFound(new { mensaje = "Este negocio no tiene propietario registrado." });

            if (!_email.EnvioDisponible) return CorreoNoDisponible();

            // An invited owner who never chose a password gets the invitation wording again.
            var esInvitacion = !await _userManager.HasPasswordAsync(propietario);

            await using var tx = await _db.Database.BeginTransactionAsync();
            if (!await _audit.RegistrarNegocioObligatorioAsync(AccionesAuditoria.PasswordPropietarioRestablecido, id,
                    $"Usuario: {propietario.Id}; enlace enviado a {EmailService.MascarEmail(propietario.Email!)}; " +
                    (esInvitacion ? "invitación (aún sin contraseña)" : "la contraseña actual sigue hasta que la cambie")))
                return AuditoriaAdmin.NoDisponible(this);

            if (!await EnviarEnlaceAccesoAsync(propietario, esInvitacion, negocio.Nombre))
                return CorreoNoEnviado();
            await tx.CommitAsync();

            return Ok(new
            {
                mensaje = $"Le enviamos a {propietario.Email} un enlace para elegir su contraseña.",
                email = propietario.Email,
                esInvitacion
            });
        }

        // ── Owner account and access links (lote 5) ───────────────────────────

        public const string CodigoCorreoNoDisponible = "CORREO_NO_DISPONIBLE";
        public const string CodigoCorreoNoEnviado = "CORREO_NO_ENVIADO";

        /// <summary>Email is switched off or has no key: say so instead of pretending a link went out.</summary>
        private ObjectResult CorreoNoDisponible() => StatusCode(StatusCodes.Status503ServiceUnavailable, new
        {
            mensaje = "El envío de correos está apagado o sin configurar, así que no podemos mandar el enlace. Revisa la configuración de correo e intenta de nuevo.",
            codigoError = CodigoCorreoNoDisponible
        });

        private ObjectResult CorreoNoEnviado() => StatusCode(StatusCodes.Status502BadGateway, new
        {
            mensaje = "No pudimos enviar el correo. Intenta de nuevo en unos minutos.",
            codigoError = CodigoCorreoNoEnviado
        });

        /// <summary>
        /// Owner account without a password, plus its mandatory audit row. The caller owns the
        /// transaction. The admin vouches for the address (as before), so it starts confirmed.
        /// </summary>
        private async Task<(ApplicationUser? Usuario, IActionResult? Error)> CrearCuentaPropietarioAsync(Guid negocioId, CrearPropietarioDto dto)
        {
            var propietario = new ApplicationUser
            {
                UserName = dto.Email,
                Email = dto.Email,
                Nombre = dto.Nombre,
                Apellido = dto.Apellido,
                NegocioId = negocioId,
                EmailConfirmed = true,
                Activo = true,
                FechaCreacion = DateTime.UtcNow,
                FechaActualizacion = DateTime.UtcNow
            };

            var resultado = await _userManager.CreateAsync(propietario);
            if (!resultado.Succeeded)
                return (null, BadRequest(new { errores = resultado.Errors.Select(e => e.Description) }));

            await _userManager.AddToRoleAsync(propietario, Roles.Propietario);

            if (!await _audit.RegistrarNegocioObligatorioAsync(AccionesAuditoria.PropietarioCreado, negocioId,
                    $"Usuario: {propietario.Id}; invitado por enlace a {EmailService.MascarEmail(dto.Email)}"))
                return (null, AuditoriaAdmin.NoDisponible(this));

            return (propietario, null);
        }

        /// <summary>
        /// The same reset token and page as "¿Olvidaste tu contraseña?" (/restablecer-contrasena).
        /// <c>invitacion=1</c> only changes the page's wording to "Crea tu contraseña".
        /// </summary>
        private async Task<bool> EnviarEnlaceAccesoAsync(ApplicationUser usuario, bool esInvitacion, string? negocioNombre)
        {
            var token = await _userManager.GeneratePasswordResetTokenAsync(usuario);
            var frontendUrl = _config["FrontendUrl"] ?? "https://appointva.com";
            var url = $"{frontendUrl}/restablecer-contrasena?token={Uri.EscapeDataString(token)}" +
                      $"&email={Uri.EscapeDataString(usuario.Email!)}{(esInvitacion ? "&invitacion=1" : "")}";
            return await _email.EnviarEnlaceAccesoAsync(usuario.Email!, usuario.Nombre ?? "", url, esInvitacion, negocioNombre);
        }

        private async Task<ApplicationUser?> ObtenerPropietarioAsync(Guid negocioId)
        {
            var rolePropietario = await _roleManager.FindByNameAsync(Roles.Propietario);
            if (rolePropietario is null) return null;

            return await _userManager.Users
                .Where(u => u.NegocioId == negocioId)
                .FirstOrDefaultAsync(u => _db.UserRoles.Any(ur => ur.UserId == u.Id && ur.RoleId == rolePropietario.Id));
        }

        // ── Horarios del negocio ──────────────────────────────────────────────

        // GET api/negocios/perfil/horarios
        [HttpGet("perfil/horarios")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.Empleado}")]
        public async Task<IActionResult> ObtenerHorarios()
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var filas = await _db.HorariosNegocios
                .Where(h => h.NegocioId == _contexto.NegocioId.Value && h.Activo == 1)
                .OrderBy(h => h.DiaSemana).ThenBy(h => h.HoraInicio)
                .ToListAsync();

            var resultado = Enumerable.Range(0, 7).Select(dia =>
            {
                var intervalos = filas.Where(h => h.DiaSemana == dia).ToList();
                return new HorarioDiaDto
                {
                    DiaSemana = (byte)dia,
                    Activo    = intervalos.Any(),
                    Intervalos = intervalos.Select(h => new HorarioIntervaloDto
                    {
                        HoraInicio = h.HoraInicio.ToString(@"hh\:mm"),
                        HoraFin    = h.HoraFin.ToString(@"hh\:mm")
                    }).ToList()
                };
            });

            return Ok(resultado);
        }

        // PUT api/negocios/perfil/horarios
        [HttpPut("perfil/horarios")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> ActualizarHorarios([FromBody] List<HorarioDiaDto> dias)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            if (dias == null) return BadRequest(new { mensaje = "El cuerpo de la petición es requerido." });
            foreach (var dia in dias)
                dia.Intervalos ??= new List<HorarioIntervaloDto>();
            if (dias.GroupBy(d => d.DiaSemana).Any(g => g.Count() > 1))
                return BadRequest(new { mensaje = "No se pueden enviar dos entradas para el mismo día." });
            if (dias.Any(d => d.DiaSemana > 6))
                return BadRequest(new { mensaje = "DiaSemana inválido. Debe ser 0 (domingo) a 6 (sábado)." });

            // Validate
            foreach (var dia in dias.Where(d => d.Activo))
            {
                if (!dia.Intervalos.Any())
                    return BadRequest(new { mensaje = $"El día {dia.DiaSemana} debe tener al menos un intervalo activo." });

                foreach (var iv in dia.Intervalos)
                {
                    if (!TimeSpan.TryParse(iv.HoraInicio, out var ini) ||
                        !TimeSpan.TryParse(iv.HoraFin,    out var fin))
                        return BadRequest(new { mensaje = "Formato de hora inválido." });
                    if (fin <= ini)
                        return BadRequest(new { mensaje = "La hora de fin debe ser posterior a la de inicio." });
                }

                // Check overlap between intervals of the same day
                var sorted = dia.Intervalos
                    .OrderBy(i => TimeSpan.Parse(i.HoraInicio))
                    .ToList();
                for (int k = 0; k < sorted.Count - 1; k++)
                {
                    if (TimeSpan.Parse(sorted[k].HoraFin) > TimeSpan.Parse(sorted[k + 1].HoraInicio))
                        return BadRequest(new { mensaje = $"Los intervalos del día {dia.DiaSemana} se solapan." });
                }
            }

            // Full replace per day: delete existing rows for each day in the payload
            var diasEnviados = dias.Select(d => (byte)d.DiaSemana).Distinct().ToList();
            var existentes = await _db.HorariosNegocios
                .Where(h => h.NegocioId == _contexto.NegocioId.Value && diasEnviados.Contains(h.DiaSemana))
                .ToListAsync();
            _db.HorariosNegocios.RemoveRange(existentes);

            // Insert new intervals for active days (sorted by start time)
            foreach (var dia in dias.Where(d => d.Activo))
            {
                var sorted = dia.Intervalos
                    .OrderBy(i => TimeSpan.Parse(i.HoraInicio))
                    .ToList();
                foreach (var iv in sorted)
                {
                    _db.HorariosNegocios.Add(new HorarioNegocio
                    {
                        Id        = Guid.NewGuid(),
                        NegocioId = _contexto.NegocioId.Value,
                        DiaSemana = dia.DiaSemana,
                        HoraInicio = TimeSpan.Parse(iv.HoraInicio),
                        HoraFin    = TimeSpan.Parse(iv.HoraFin),
                        Activo     = 1
                    });
                }
            }

            await _db.SaveChangesAsync();
            await InvalidarNegocioPublicoAsync(_contexto.NegocioId.Value);
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

        // POST api/negocios/perfil/politicas
        [HttpPost("perfil/politicas")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> SubirPoliticas(IFormFile archivo)
        {
            if (_contexto.NegocioId is null) return Unauthorized();
            return await SubirImagenNegocioAsync(_contexto.NegocioId.Value, archivo, "politicas");
        }

        // DELETE api/negocios/perfil/logo
        [HttpDelete("perfil/logo")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> EliminarLogo()
        {
            if (_contexto.NegocioId is null) return Unauthorized();
            var negocio = await _repo.ObtenerPorIdAsync(_contexto.NegocioId.Value);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });
            negocio.LogoUrl = null;
            negocio.FechaActualizacion = DateTime.UtcNow;
            await _repo.ActualizarAsync(negocio);
            await _cacheStore.EvictByTagAsync($"negocio-{negocio.Slug}", CancellationToken.None);
            return NoContent();
        }

        // DELETE api/negocios/perfil/portada
        [HttpDelete("perfil/portada")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> EliminarPortada()
        {
            if (_contexto.NegocioId is null) return Unauthorized();
            var negocio = await _repo.ObtenerPorIdAsync(_contexto.NegocioId.Value);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });
            negocio.PortadaUrl = null;
            negocio.PortadaObjectPosition = null;
            negocio.FechaActualizacion = DateTime.UtcNow;
            await _repo.ActualizarAsync(negocio);
            await _cacheStore.EvictByTagAsync($"negocio-{negocio.Slug}", CancellationToken.None);
            return NoContent();
        }

        // PATCH api/negocios/perfil/portada/posicion — B11 (OM-04): saves the cover focal
        // point on its own, so "Confirmar" in the positioning overlay persists it without
        // the full PUT /perfil update.
        [HttpPatch("perfil/portada/posicion")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> ActualizarPosicionPortada([FromBody] PortadaPosicionDto dto)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var posicion = dto.PortadaObjectPosition.Trim();
            if (!PosicionDentroDeRango(posicion))
                return BadRequest(new { mensaje = "Cada valor de la posición debe estar entre 0% y 100%." });

            var negocio = await _repo.ObtenerPorIdAsync(_contexto.NegocioId.Value);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });
            if (string.IsNullOrWhiteSpace(negocio.PortadaUrl))
                return BadRequest(new { mensaje = "Primero sube una foto de portada." });

            negocio.PortadaObjectPosition = posicion;
            negocio.FechaActualizacion = DateTime.UtcNow;
            await _repo.ActualizarAsync(negocio);
            await _cacheStore.EvictByTagAsync($"negocio-{negocio.Slug}", CancellationToken.None);
            return Ok(new { portadaObjectPosition = negocio.PortadaObjectPosition });
        }

        private static bool PosicionDentroDeRango(string posicion)
        {
            var partes = posicion.Split(' ');
            return partes.Length == 2 && partes.All(p =>
                decimal.TryParse(p.TrimEnd('%'), System.Globalization.NumberStyles.AllowDecimalPoint,
                    System.Globalization.CultureInfo.InvariantCulture, out var v) && v >= 0 && v <= 100);
        }

        // DELETE api/negocios/perfil/politicas
        [HttpDelete("perfil/politicas")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> EliminarPoliticas()
        {
            if (_contexto.NegocioId is null) return Unauthorized();
            var negocio = await _repo.ObtenerPorIdAsync(_contexto.NegocioId.Value);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });
            negocio.PoliticasUrl = null;
            negocio.FechaActualizacion = DateTime.UtcNow;
            await _repo.ActualizarAsync(negocio);
            await _cacheStore.EvictByTagAsync($"negocio-{negocio.Slug}", CancellationToken.None);
            return NoContent();
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
                else if (tipo == "politicas")
                    negocio.PoliticasUrl = url;
                else
                {
                    negocio.PortadaUrl = url;
                    // Subir una foto es una decisión explícita: gana sobre el fondo
                    // generado que estuviera elegido, si no la subida no se vería.
                    negocio.PortadaPreset = null;
                }

                negocio.FechaActualizacion = DateTime.UtcNow;
                await _repo.ActualizarAsync(negocio);
                await _cacheStore.EvictByTagAsync($"negocio-{negocio.Slug}", CancellationToken.None);

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

            var negocio = await _repo.ObtenerPorIdAsync(_contexto.NegocioId.Value);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            var total = await _db.ImagenesNegocios
                .CountAsync(i => i.NegocioId == _contexto.NegocioId.Value);
            if (total >= 20)
                return BadRequest(new { mensaje = "Máximo 20 imágenes en la galería." });

            // After a deletion the count no longer matches the highest position, so a new
            // photo goes after the current last one instead of reusing a taken position.
            var ultimoOrden = total == 0 ? 0 : await _db.ImagenesNegocios
                .Where(i => i.NegocioId == _contexto.NegocioId.Value)
                .MaxAsync(i => i.Orden);

            try
            {
                var url = await _storage.SubirImagenAsync(archivo, "negocios/galeria");
                var imagen = new ImagenNegocio
                {
                    Id = Guid.NewGuid(),
                    NegocioId = _contexto.NegocioId.Value,
                    Url = url,
                    Descripcion = string.IsNullOrWhiteSpace(descripcion) ? null : descripcion.Trim(),
                    Orden = ultimoOrden + 1,
                    FechaCreacion = DateTime.UtcNow
                };
                _db.ImagenesNegocios.Add(imagen);
                await _db.SaveChangesAsync();
                await _cacheStore.EvictByTagAsync($"negocio-{negocio.Slug}", CancellationToken.None);
                return Ok(new { imagen.Id, imagen.Url, imagen.Descripcion, imagen.Orden, imagen.FechaCreacion });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { mensaje = ex.Message });
            }
        }

        // PATCH api/negocios/galeria/reordenar — B12 (OM-15): receives every photo id of the
        // business in the new order (first = first photo clients see) and stores 1..n.
        [HttpPatch("galeria/reordenar")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> ReordenarGaleria([FromBody] ReordenarGaleriaDto dto)
        {
            if (_contexto.NegocioId is null) return Unauthorized();
            var negocioId = _contexto.NegocioId.Value;

            var negocio = await _repo.ObtenerPorIdAsync(negocioId);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            var imagenes = await _db.ImagenesNegocios
                .Where(i => i.NegocioId == negocioId)
                .ToListAsync();

            // The list must be exactly this business's gallery: no duplicates, no missing
            // photos and no ids from another business (tenant isolation).
            var ids = dto.Ids ?? new List<Guid>();
            var propios = imagenes.Select(i => i.Id).ToHashSet();
            if (ids.Count != propios.Count || ids.Distinct().Count() != ids.Count || !ids.All(propios.Contains))
                return BadRequest(new { mensaje = "La lista debe incluir cada foto de la galería una sola vez." });

            var porId = imagenes.ToDictionary(i => i.Id);
            for (var i = 0; i < ids.Count; i++)
                porId[ids[i]].Orden = i + 1;

            await _db.SaveChangesAsync();
            await _cacheStore.EvictByTagAsync($"negocio-{negocio.Slug}", CancellationToken.None);

            return Ok(imagenes
                .OrderBy(i => i.Orden)
                .Select(i => new { i.Id, i.Url, i.Descripcion, i.Orden, i.FechaCreacion }));
        }

        // DELETE api/negocios/galeria/{id}
        [HttpDelete("galeria/{id:guid}")]
        [Authorize(Roles = Roles.Propietario)]
        public async Task<IActionResult> EliminarImagenGaleria(Guid id)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var negocio = await _repo.ObtenerPorIdAsync(_contexto.NegocioId.Value);
            if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

            var imagen = await _db.ImagenesNegocios
                .FirstOrDefaultAsync(i => i.Id == id && i.NegocioId == _contexto.NegocioId.Value);
            if (imagen is null) return NotFound();

            _db.ImagenesNegocios.Remove(imagen);
            await _db.SaveChangesAsync();
            await _cacheStore.EvictByTagAsync($"negocio-{negocio.Slug}", CancellationToken.None);
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
            await InvalidarNegocioPublicoAsync(_contexto.NegocioId.Value);

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
            await InvalidarNegocioPublicoAsync(_contexto.NegocioId.Value);

            return NoContent();
        }

        /// <summary>
        /// La página pública lleva horario y días cerrados en caché (5 min): al cambiarlos,
        /// se invalida para que la reserva no marque como cerrado un día ya abierto.
        /// </summary>
        private async Task InvalidarNegocioPublicoAsync(Guid negocioId)
        {
            var slug = await _db.Negocios
                .Where(n => n.Id == negocioId)
                .Select(n => n.Slug)
                .FirstOrDefaultAsync();
            if (!string.IsNullOrEmpty(slug))
                await _cacheStore.EvictByTagAsync($"negocio-{slug}", CancellationToken.None);
        }

        // PATCH api/negocios/{id}/propietario/password (the admin typing the owner's new password)
        // was removed in lote 5 (I4): see EnviarEnlaceContrasenaPropietario.

        private static NegocioDto MapearDto(Negocio n) => MapearDto<NegocioDto>(n);

        private static T MapearDto<T>(Negocio n) where T : NegocioDto, new() => new()
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
            PortadaObjectPosition = n.PortadaObjectPosition,
            PortadaPreset = n.PortadaPreset,
            PoliticasUrl = n.PoliticasUrl,
            ColorPrimario = n.ColorPrimario,
            ColorSecundario = n.ColorSecundario,
            ZonaHoraria = n.ZonaHoraria,
            Moneda = n.Moneda,
            HorasRecordatorio = n.HorasRecordatorio,
            HorasCancelacion = n.HorasCancelacion,
            DiasAnticipacionMinima = n.DiasAnticipacionMinima,
            AutoConfirmar = n.AutoConfirmar,
            ListaEsperaActiva = n.ListaEsperaActiva,
            ModuloPagosHabilitado = n.ModuloPagosHabilitado,
            MetodoNotificacion = n.MetodoNotificacion,
            TelefonoWhatsApp = n.TelefonoWhatsApp,
            RequiereAnticipo = n.RequiereAnticipo,
            MontoAnticipo = n.MontoAnticipo,
            InstruccionesAnticipo = n.InstruccionesAnticipo,
            PorcentajeAnticipo = n.PorcentajeAnticipo,
            HorasCancelacionConReembolso = n.HorasCancelacionConReembolso,
            PoliticaCancelacionAnticipo = n.PoliticaCancelacionAnticipo,
            InstagramUrl = n.InstagramUrl,
            FacebookUrl = n.FacebookUrl,
            TiktokUrl = n.TiktokUrl,
            Activo = n.Activo == 1,
            PlanNombre = n.Plan?.Nombre,
            Sector = n.Sector
        };
    }
}
