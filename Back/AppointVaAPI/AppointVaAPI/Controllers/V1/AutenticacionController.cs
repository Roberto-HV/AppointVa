using AppointVaAPI.Data;
using AppointVaAPI.Helpers;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Autenticacion;
using AppointVaAPI.Services;
using AppointVaAPI.Services.IServices;
using AppointVaAPI.Constants;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    [Route("api/auth")]
    public class AutenticacionController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IJwtService _jwtService;
        private readonly IEmailService _email;
        private readonly IConfiguration _config;
        private readonly IBlobStorageService _storage;
        private readonly IAuditService _audit;
        private readonly ApplicationDbContext _db;
        private readonly IPanelJobsAccesoService _panelJobs;

        public AutenticacionController(
            UserManager<ApplicationUser> userManager,
            IJwtService jwtService,
            IEmailService email,
            IConfiguration config,
            IBlobStorageService storage,
            IAuditService audit,
            ApplicationDbContext db,
            IPanelJobsAccesoService panelJobs)
        {
            _userManager = userManager;
            _jwtService = jwtService;
            _email = email;
            _config = config;
            _storage = storage;
            _audit = audit;
            _db = db;
            _panelJobs = panelJobs;
        }

        // POST api/auth/login
        [HttpPost("login")]
        [EnableRateLimiting("Auth")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            var usuario = await _userManager.FindByEmailAsync(dto.Email);
            if (usuario is null || !usuario.Activo)
                return Unauthorized(new { mensaje = "Credenciales inválidas" });

            // A deactivated employee answers exactly like invalid credentials (no enumeration).
            if (await AccesoEmpleadoHelper.AccesoBloqueadoAsync(_db, _userManager, usuario))
            {
                await _audit.RegistrarAsync("LoginFallido", detalles: "Empleado inactivo", usuarioId: usuario.Id);
                return Unauthorized(new { mensaje = "Credenciales inválidas" });
            }

            // S5 (account enumeration): only existing accounts can be locked out, so a
            // distinct status here would confirm the email exists. Answer exactly like
            // invalid credentials; the lockout itself still blocks the attempt and is audited.
            if (await _userManager.IsLockedOutAsync(usuario))
            {
                await _audit.RegistrarAsync("LoginFallido", detalles: "Cuenta bloqueada", usuarioId: usuario.Id);
                return Unauthorized(new { mensaje = "Credenciales inválidas" });
            }

            if (!await _userManager.CheckPasswordAsync(usuario, dto.Contrasena))
            {
                await _userManager.AccessFailedAsync(usuario);
                await _audit.RegistrarAsync("LoginFallido", detalles: "Contraseña incorrecta", usuarioId: usuario.Id);
                return Unauthorized(new { mensaje = "Credenciales inválidas" });
            }

            await _userManager.ResetAccessFailedCountAsync(usuario);

            if (!usuario.EmailConfirmed)
                return StatusCode(403, new { mensaje = "Debes verificar tu correo antes de iniciar sesión.", codigoError = "EMAIL_NO_VERIFICADO" });

            var roles = await _userManager.GetRolesAsync(usuario);
            var rol = roles.FirstOrDefault() ?? string.Empty;

            // Si tiene 2FA habilitado, emitir un challenge token en lugar del JWT completo
            if (await _userManager.GetTwoFactorEnabledAsync(usuario))
            {
                var challengeToken = _jwtService.GenerarChallengeToken2FA(usuario.Id);
                return Ok(new LoginRespuestaDto
                {
                    Requiere2FA   = true,
                    ChallengeToken = challengeToken
                });
            }

            var token = _jwtService.GenerarToken(usuario, rol);
            var refreshToken = await _jwtService.GenerarRefreshTokenAsync(usuario.Id);

            await _audit.RegistrarAsync("Login", usuarioId: usuario.Id);

            return Ok(new LoginRespuestaDto
            {
                Token = token,
                TokenExpiracion = DateTime.UtcNow.AddMinutes(15),
                RefreshToken = refreshToken,
                Usuario = new UsuarioInfoDto
                {
                    Id = usuario.Id,
                    Email = usuario.Email!,
                    NombreCompleto = $"{usuario.Nombre} {usuario.Apellido}".Trim(),
                    Rol = rol,
                    NegocioId = usuario.NegocioId,
                    FotoUrl = usuario.FotoUrl
                }
            });
        }

        // POST api/auth/refresh
        [HttpPost("refresh")]
        [EnableRateLimiting("Auth")]
        public async Task<IActionResult> Refresh([FromBody] RefrescarTokenDto dto)
        {
            var refreshToken = await _jwtService.ValidarRefreshTokenAsync(dto.RefreshToken);
            if (refreshToken is null)
                return Unauthorized(new { mensaje = "Refresh token inválido o expirado" });

            var usuario = refreshToken.Usuario!;
            if (!usuario.Activo || await AccesoEmpleadoHelper.AccesoBloqueadoAsync(_db, _userManager, usuario))
                return Unauthorized(new { mensaje = "Cuenta inactiva" });

            // Marcar el token anterior como usado antes de generar el nuevo (reduce ventana de race)
            refreshToken.Usado = true;
            await _db.SaveChangesAsync();

            var roles = await _userManager.GetRolesAsync(usuario);
            var rol = roles.FirstOrDefault() ?? string.Empty;

            var nuevoToken = _jwtService.GenerarToken(usuario, rol);
            var nuevoRefreshToken = await _jwtService.GenerarRefreshTokenAsync(usuario.Id);

            return Ok(new LoginRespuestaDto
            {
                Token = nuevoToken,
                TokenExpiracion = DateTime.UtcNow.AddMinutes(15),
                RefreshToken = nuevoRefreshToken,
                Usuario = new UsuarioInfoDto
                {
                    Id = usuario.Id,
                    Email = usuario.Email!,
                    NombreCompleto = $"{usuario.Nombre} {usuario.Apellido}".Trim(),
                    Rol = rol,
                    NegocioId = usuario.NegocioId,
                    FotoUrl = usuario.FotoUrl
                }
            });
        }

        // POST api/auth/logout
        [Authorize]
        [HttpPost("logout")]
        public async Task<IActionResult> Logout([FromBody] RefrescarTokenDto dto)
        {
            await _jwtService.RevocarRefreshTokenAsync(dto.RefreshToken);

            var sub = User.FindFirst("sub")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (Guid.TryParse(sub, out var usuarioId))
                _panelJobs.RevocarSesionesDeUsuario(usuarioId);

            await _audit.RegistrarAsync("Logout");
            return NoContent();
        }

        // GET api/auth/me
        [Authorize]
        [HttpGet("me")]
        public async Task<IActionResult> Me()
        {
            var usuarioId = User.FindFirst("sub")?.Value;
            if (usuarioId is null) return Unauthorized();

            var usuario = await _userManager.FindByIdAsync(usuarioId);
            if (usuario is null) return NotFound();

            var roles = await _userManager.GetRolesAsync(usuario);
            return Ok(new UsuarioInfoDto
            {
                Id = usuario.Id,
                Email = usuario.Email!,
                NombreCompleto = $"{usuario.Nombre} {usuario.Apellido}".Trim(),
                Rol = roles.FirstOrDefault() ?? string.Empty,
                NegocioId = usuario.NegocioId,
                FotoUrl = usuario.FotoUrl
            });
        }

        // POST api/auth/perfil/foto
        [Authorize]
        [HttpPost("perfil/foto")]
        public async Task<IActionResult> SubirFoto(IFormFile archivo)
        {
            var usuarioId = User.FindFirst("sub")?.Value;
            if (usuarioId is null) return Unauthorized();

            var usuario = await _userManager.FindByIdAsync(usuarioId);
            if (usuario is null) return NotFound();

            if (archivo is null || archivo.Length == 0)
                return BadRequest(new { mensaje = "Archivo requerido" });

            var url = await _storage.SubirImagenAsync(archivo, "usuarios/fotos");
            usuario.FotoUrl = url;
            usuario.FechaActualizacion = DateTime.UtcNow;
            await _userManager.UpdateAsync(usuario);

            return Ok(new { fotoUrl = url });
        }

        // POST api/auth/recuperar-contrasena
        [HttpPost("recuperar-contrasena")]
        [EnableRateLimiting("Auth")]
        public async Task<IActionResult> RecuperarContrasena([FromBody] RecuperarContrasenaDto dto)
        {
            // Siempre responder OK para no revelar si el email existe
            var usuario = await _userManager.FindByEmailAsync(dto.Email);
            if (usuario is not null && usuario.Activo)
            {
                var token = await _userManager.GeneratePasswordResetTokenAsync(usuario);
                var tokenEncoded = Uri.EscapeDataString(token);
                var frontendUrl = _config["FrontendUrl"] ?? "https://appointva.com";
                var urlReset = $"{frontendUrl}/restablecer-contrasena?token={tokenEncoded}&email={Uri.EscapeDataString(dto.Email)}";

                _ = Task.Run(async () =>
                    await _email.EnviarRecuperacionContrasenaAsync(dto.Email, usuario.Nombre ?? "Usuario", urlReset));
            }

            return Ok(new { mensaje = "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña." });
        }

        // POST api/auth/restablecer-contrasena
        [HttpPost("restablecer-contrasena")]
        [EnableRateLimiting("Auth")]
        public async Task<IActionResult> RestablecerContrasena([FromBody] RestablecerContrasenaDto dto)
        {
            var usuario = await _userManager.FindByEmailAsync(dto.Email);
            if (usuario is null)
                return BadRequest(new { mensaje = "El enlace de recuperación no es válido o ha expirado." });

            var resultado = await _userManager.ResetPasswordAsync(usuario, dto.Token, dto.NuevaContrasena);
            if (!resultado.Succeeded)
                return BadRequest(new { mensaje = "El enlace de recuperación no es válido o ha expirado." });

            await _jwtService.RevocarTodosRefreshTokensAsync(usuario.Id);

            return Ok(new { mensaje = "Contraseña restablecida correctamente. Ya puedes iniciar sesión." });
        }

        // POST api/auth/cambiar-password
        [Authorize]
        [EnableRateLimiting("Auth")]
        [HttpPost("cambiar-password")]
        public async Task<IActionResult> CambiarPassword([FromBody] CambiarPasswordDto dto)
        {
            var usuarioId = User.FindFirst("sub")?.Value;
            if (usuarioId is null) return Unauthorized();

            var usuario = await _userManager.FindByIdAsync(usuarioId);
            if (usuario is null) return NotFound();

            var resultado = await _userManager.ChangePasswordAsync(usuario, dto.PasswordActual, dto.PasswordNuevo);
            if (!resultado.Succeeded)
            {
                await _userManager.AccessFailedAsync(usuario);
                return BadRequest(new { errores = resultado.Errors.Select(e => e.Description) });
            }

            // Revocar todos los refresh tokens para forzar nuevo login
            await _jwtService.RevocarTodosRefreshTokensAsync(usuario.Id);

            await _audit.RegistrarAsync("CambiarPassword");

            return Ok(new { mensaje = "Contraseña actualizada correctamente. Inicia sesión nuevamente." });
        }

        // ── 2FA ───────────────────────────────────────────────────────────────────

        // GET api/auth/2fa/estado
        [Authorize]
        [HttpGet("2fa/estado")]
        public async Task<IActionResult> ObtenerEstado2FA()
        {
            var usuarioId = User.FindFirst("sub")?.Value;
            if (usuarioId is null) return Unauthorized();

            var usuario = await _userManager.FindByIdAsync(usuarioId);
            if (usuario is null) return NotFound();

            var llave = await _userManager.GetAuthenticatorKeyAsync(usuario);

            var habilitado = await _userManager.GetTwoFactorEnabledAsync(usuario);

            return Ok(new EstadoDosFactoresDto
            {
                Habilitado          = habilitado,
                TieneConfiguracion  = !string.IsNullOrEmpty(llave),
                CodigosRecuperacionRestantes = habilitado ? await _userManager.CountRecoveryCodesAsync(usuario) : 0
            });
        }

        // POST api/auth/2fa/configurar — genera/renueva la clave TOTP y devuelve el URI
        [Authorize]
        [HttpPost("2fa/configurar")]
        public async Task<IActionResult> Configurar2FA()
        {
            var usuarioId = User.FindFirst("sub")?.Value;
            if (usuarioId is null) return Unauthorized();

            var usuario = await _userManager.FindByIdAsync(usuarioId);
            if (usuario is null) return NotFound();

            await _userManager.ResetAuthenticatorKeyAsync(usuario);
            var llave = await _userManager.GetAuthenticatorKeyAsync(usuario);

            // Formatear llave en grupos de 4 para facilitar ingreso manual
            var llaveFormateada = string.Join(" ", Enumerable.Range(0, llave!.Length / 4)
                .Select(i => llave.Substring(i * 4, Math.Min(4, llave.Length - i * 4))));

            var emisor = Uri.EscapeDataString("AppointVa");
            var cuenta = Uri.EscapeDataString(usuario.Email!);
            var uri = $"otpauth://totp/{emisor}:{cuenta}?secret={llave}&issuer={emisor}&algorithm=SHA1&digits=6&period=30";

            return Ok(new ConfigurarDosFactoresRespuestaDto
            {
                Uri   = uri,
                Llave = llaveFormateada.ToUpper()
            });
        }

        // POST api/auth/2fa/activar — verifica el código y habilita 2FA
        [Authorize]
        [HttpPost("2fa/activar")]
        public async Task<IActionResult> Activar2FA([FromBody] ActivarDosFactoresDto dto)
        {
            var usuarioId = User.FindFirst("sub")?.Value;
            if (usuarioId is null) return Unauthorized();

            var usuario = await _userManager.FindByIdAsync(usuarioId);
            if (usuario is null) return NotFound();

            var codigoLimpio = dto.Codigo.Replace(" ", "").Replace("-", "");
            var valido = await _userManager.VerifyTwoFactorTokenAsync(
                usuario, _userManager.Options.Tokens.AuthenticatorTokenProvider, codigoLimpio);

            if (!valido)
                return BadRequest(new { mensaje = "Código incorrecto. Verifica que la hora de tu dispositivo esté sincronizada." });

            await _userManager.SetTwoFactorEnabledAsync(usuario, true);

            // B8: a fresh set on every activation; the plain codes leave the server only here.
            var codigos = await _userManager.GenerateNewTwoFactorRecoveryCodesAsync(usuario, CantidadCodigosRecuperacion);
            await _audit.RegistrarAsync("2FAActivado", "Usuario", usuario.Id.ToString(), usuarioId: usuario.Id);

            return Ok(new CodigosRecuperacionDto
            {
                Mensaje = "Autenticación de dos factores activada correctamente.",
                CodigosRecuperacion = codigos?.ToList() ?? []
            });
        }

        /// <summary>B8: how many recovery codes a user gets each time a set is generated.</summary>
        public const int CantidadCodigosRecuperacion = 10;

        // POST api/auth/2fa/codigos-recuperacion — replaces the whole set (old codes stop working)
        [Authorize]
        [EnableRateLimiting("Auth")]
        [HttpPost("2fa/codigos-recuperacion")]
        public async Task<IActionResult> RegenerarCodigosRecuperacion([FromBody] RegenerarCodigosRecuperacionDto dto)
        {
            var usuarioId = User.FindFirst("sub")?.Value;
            if (usuarioId is null) return Unauthorized();

            var usuario = await _userManager.FindByIdAsync(usuarioId);
            if (usuario is null) return NotFound();

            if (!await _userManager.GetTwoFactorEnabledAsync(usuario))
                return BadRequest(new { mensaje = "Activa la verificación en dos pasos antes de generar códigos de recuperación." });

            bool verificado;
            if (!string.IsNullOrEmpty(dto.Contrasena))
                verificado = await _userManager.CheckPasswordAsync(usuario, dto.Contrasena);
            else if (!string.IsNullOrWhiteSpace(dto.Codigo))
                verificado = await _userManager.VerifyTwoFactorTokenAsync(
                    usuario, _userManager.Options.Tokens.AuthenticatorTokenProvider,
                    dto.Codigo.Replace(" ", "").Replace("-", ""));
            else
                return BadRequest(new { mensaje = "Ingresa tu contraseña o un código de tu app autenticadora." });

            if (!verificado)
            {
                await _audit.RegistrarAsync("CodigosRecuperacionRegeneracionFallida", "Usuario", usuario.Id.ToString(), usuarioId: usuario.Id);
                return BadRequest(new { mensaje = "La contraseña o el código no son correctos." });
            }

            var codigos = await _userManager.GenerateNewTwoFactorRecoveryCodesAsync(usuario, CantidadCodigosRecuperacion);
            await _audit.RegistrarAsync("CodigosRecuperacionRegenerados", "Usuario", usuario.Id.ToString(), usuarioId: usuario.Id);

            return Ok(new CodigosRecuperacionDto
            {
                Mensaje = "Se generaron códigos nuevos. Los anteriores ya no sirven.",
                CodigosRecuperacion = codigos?.ToList() ?? []
            });
        }

        // POST api/auth/2fa/desactivar — deshabilita 2FA
        [Authorize]
        [HttpPost("2fa/desactivar")]
        public async Task<IActionResult> Desactivar2FA([FromBody] ActivarDosFactoresDto dto)
        {
            var usuarioId = User.FindFirst("sub")?.Value;
            if (usuarioId is null) return Unauthorized();

            var usuario = await _userManager.FindByIdAsync(usuarioId);
            if (usuario is null) return NotFound();

            var codigoLimpio = dto.Codigo.Replace(" ", "").Replace("-", "");
            var valido = await _userManager.VerifyTwoFactorTokenAsync(
                usuario, _userManager.Options.Tokens.AuthenticatorTokenProvider, codigoLimpio);

            if (!valido)
                return BadRequest(new { mensaje = "Código incorrecto." });

            await _userManager.SetTwoFactorEnabledAsync(usuario, false);
            await _userManager.ResetAuthenticatorKeyAsync(usuario);
            // B8: leftover recovery codes must not survive into a later activation.
            await _userManager.RemoveAuthenticationTokenAsync(
                usuario, UserStoreCodigosRecuperacion.ProveedorInterno, UserStoreCodigosRecuperacion.NombreToken);
            await _audit.RegistrarAsync("2FADesactivado", "Usuario", usuario.Id.ToString(), usuarioId: usuario.Id);

            return Ok(new { mensaje = "Autenticación de dos factores desactivada." });
        }

        // DELETE api/auth/cuenta — eliminar cuenta (anonimización LFPDPPP)
        [Authorize]
        [HttpDelete("cuenta")]
        public async Task<IActionResult> EliminarCuenta([FromBody] EliminarCuentaDto dto)
        {
            var usuarioId = User.FindFirst("sub")?.Value;
            if (usuarioId is null) return Unauthorized();

            var usuario = await _userManager.FindByIdAsync(usuarioId);
            if (usuario is null) return NotFound();

            if (!await _userManager.CheckPasswordAsync(usuario, dto.Contrasena))
                return BadRequest(new { mensaje = "Contraseña incorrecta." });

            var roles = await _userManager.GetRolesAsync(usuario);

            // El propietario debe cerrar su negocio antes de eliminar la cuenta
            if (roles.Contains(Roles.Propietario) && usuario.NegocioId.HasValue)
            {
                var negocio = await _db.Negocios.FindAsync(usuario.NegocioId.Value);
                if (negocio is not null && negocio.Activo == 1)
                    return BadRequest(new
                    {
                        mensaje = "No puedes eliminar tu cuenta mientras tengas un negocio activo. Contacta a soporte@appointva.com para cerrar tu negocio primero."
                    });
            }

            // Si es empleado: desvincular su cuenta del registro de empleado
            if (roles.Contains(Roles.Empleado))
            {
                var empleado = await _db.Empleados
                    .FirstOrDefaultAsync(e => e.UsuarioId == usuario.Id);
                if (empleado is not null)
                    empleado.UsuarioId = null;
            }

            // Revocar todos los tokens
            await _jwtService.RevocarTodosRefreshTokensAsync(usuario.Id);

            // Anonimizar datos personales (los registros históricos se conservan sin PII)
            var anonEmail = $"{Guid.NewGuid():N}@eliminado.local";
            usuario.Nombre = "Usuario";
            usuario.Apellido = "Eliminado";
            usuario.Email = anonEmail;
            usuario.NormalizedEmail = anonEmail.ToUpperInvariant();
            usuario.UserName = anonEmail;
            usuario.NormalizedUserName = anonEmail.ToUpperInvariant();
            usuario.PhoneNumber = null;
            usuario.FotoUrl = null;
            usuario.Activo = false;
            usuario.FechaActualizacion = DateTime.UtcNow;

            await _userManager.UpdateAsync(usuario);
            await _db.SaveChangesAsync();

            await _audit.RegistrarAsync("EliminarCuenta", usuarioId: usuario.Id);

            return NoContent();
        }

        // POST api/auth/2fa/verificar — segundo factor durante el login
        [HttpPost("2fa/verificar")]
        [EnableRateLimiting("TwoFA")]
        public async Task<IActionResult> Verificar2FA([FromBody] VerificarDosFactoresDto dto)
        {
            var usuarioId = _jwtService.ValidarChallengeToken2FA(dto.ChallengeToken);
            if (usuarioId is null)
                return Unauthorized(new { mensaje = "Token de verificación inválido o expirado. Inicia sesión de nuevo." });

            var usuario = await _userManager.FindByIdAsync(usuarioId.Value.ToString());
            if (usuario is null || !usuario.Activo
                || await AccesoEmpleadoHelper.AccesoBloqueadoAsync(_db, _userManager, usuario))
                return Unauthorized(new { mensaje = "Usuario no encontrado." });

            int? codigosRestantes = null;
            if (!string.IsNullOrWhiteSpace(dto.CodigoRecuperacion))
            {
                // B8: same endpoint and rate limit as the TOTP code; each code works once.
                var canje = await _userManager.RedeemTwoFactorRecoveryCodeAsync(usuario, dto.CodigoRecuperacion.Trim());
                if (!canje.Succeeded)
                {
                    await _audit.RegistrarAsync("CodigoRecuperacionFallido", "Usuario", usuario.Id.ToString(), usuarioId: usuario.Id);
                    return Unauthorized(new { mensaje = "Código de recuperación incorrecto o ya usado." });
                }
                codigosRestantes = await _userManager.CountRecoveryCodesAsync(usuario);
                await _audit.RegistrarAsync("CodigoRecuperacionUsado", "Usuario", usuario.Id.ToString(),
                    $"Restantes: {codigosRestantes}", usuario.Id);
            }
            else
            {
                if (string.IsNullOrWhiteSpace(dto.Codigo))
                    return BadRequest(new { mensaje = "Ingresa el código de tu app autenticadora." });

                var codigoLimpio = dto.Codigo.Replace(" ", "").Replace("-", "");
                var valido = await _userManager.VerifyTwoFactorTokenAsync(
                    usuario, _userManager.Options.Tokens.AuthenticatorTokenProvider, codigoLimpio);

                if (!valido)
                    return Unauthorized(new { mensaje = "Código incorrecto o expirado." });
            }

            var roles = await _userManager.GetRolesAsync(usuario);
            var rol = roles.FirstOrDefault() ?? string.Empty;

            var token = _jwtService.GenerarToken(usuario, rol);
            var refreshToken = await _jwtService.GenerarRefreshTokenAsync(usuario.Id);

            return Ok(new LoginRespuestaDto
            {
                Token = token,
                TokenExpiracion = DateTime.UtcNow.AddMinutes(15),
                RefreshToken = refreshToken,
                CodigosRecuperacionRestantes = codigosRestantes,
                Usuario = new UsuarioInfoDto
                {
                    Id = usuario.Id,
                    Email = usuario.Email!,
                    NombreCompleto = $"{usuario.Nombre} {usuario.Apellido}".Trim(),
                    Rol = rol,
                    NegocioId = usuario.NegocioId,
                    FotoUrl = usuario.FotoUrl
                }
            });
        }
    }
}
