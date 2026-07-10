using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Autenticacion;
using AppointVaAPI.Services.IServices;
using AppointVaAPI.Constants;
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

        public AutenticacionController(
            UserManager<ApplicationUser> userManager,
            IJwtService jwtService,
            IEmailService email,
            IConfiguration config,
            IBlobStorageService storage,
            IAuditService audit,
            ApplicationDbContext db)
        {
            _userManager = userManager;
            _jwtService = jwtService;
            _email = email;
            _config = config;
            _storage = storage;
            _audit = audit;
            _db = db;
        }

        // POST api/auth/login
        [HttpPost("login")]
        [EnableRateLimiting("Auth")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            var usuario = await _userManager.FindByEmailAsync(dto.Email);
            if (usuario is null || !usuario.Activo)
                return Unauthorized(new { mensaje = "Credenciales invÃ¡lidas" });

            if (await _userManager.IsLockedOutAsync(usuario))
                return StatusCode(429, new { mensaje = "Cuenta bloqueada temporalmente. Intenta en 15 minutos." });

            if (!await _userManager.CheckPasswordAsync(usuario, dto.Contrasena))
            {
                await _userManager.AccessFailedAsync(usuario);
                await _audit.RegistrarAsync("LoginFallido", detalles: "ContraseÃ±a incorrecta", usuarioId: usuario.Id);
                return Unauthorized(new { mensaje = "Credenciales invÃ¡lidas" });
            }

            await _userManager.ResetAccessFailedCountAsync(usuario);

            if (!usuario.EmailConfirmed)
                return StatusCode(403, new { mensaje = "Debes verificar tu correo antes de iniciar sesiÃ³n.", codigoError = "EMAIL_NO_VERIFICADO" });

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
                return Unauthorized(new { mensaje = "Refresh token invÃ¡lido o expirado" });

            var usuario = refreshToken.Usuario!;
            if (!usuario.Activo)
                return Unauthorized(new { mensaje = "Cuenta inactiva" });

            // Marcar el token anterior como usado
            refreshToken.Usado = true;

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
                    await _email.EnviarRecuperacionContrasenaAsync(dto.Email, usuario.Nombre, urlReset));
            }

            return Ok(new { mensaje = "Si el correo estÃ¡ registrado, recibirÃ¡s un enlace para restablecer tu contraseÃ±a." });
        }

        // POST api/auth/restablecer-contrasena
        [HttpPost("restablecer-contrasena")]
        [EnableRateLimiting("Auth")]
        public async Task<IActionResult> RestablecerContrasena([FromBody] RestablecerContrasenaDto dto)
        {
            var usuario = await _userManager.FindByEmailAsync(dto.Email);
            if (usuario is null)
                return BadRequest(new { mensaje = "El enlace de recuperaciÃ³n no es vÃ¡lido o ha expirado." });

            var resultado = await _userManager.ResetPasswordAsync(usuario, dto.Token, dto.NuevaContrasena);
            if (!resultado.Succeeded)
                return BadRequest(new { mensaje = "El enlace de recuperaciÃ³n no es vÃ¡lido o ha expirado." });

            await _jwtService.RevocarTodosRefreshTokensAsync(usuario.Id);

            return Ok(new { mensaje = "ContraseÃ±a restablecida correctamente. Ya puedes iniciar sesiÃ³n." });
        }

        // POST api/auth/cambiar-password
        [Authorize]
        [HttpPost("cambiar-password")]
        public async Task<IActionResult> CambiarPassword([FromBody] CambiarPasswordDto dto)
        {
            var usuarioId = User.FindFirst("sub")?.Value;
            if (usuarioId is null) return Unauthorized();

            var usuario = await _userManager.FindByIdAsync(usuarioId);
            if (usuario is null) return NotFound();

            var resultado = await _userManager.ChangePasswordAsync(usuario, dto.PasswordActual, dto.PasswordNuevo);
            if (!resultado.Succeeded)
                return BadRequest(new { errores = resultado.Errors.Select(e => e.Description) });

            // Revocar todos los refresh tokens para forzar nuevo login
            await _jwtService.RevocarTodosRefreshTokensAsync(usuario.Id);

            await _audit.RegistrarAsync("CambiarPassword");

            return Ok(new { mensaje = "ContraseÃ±a actualizada correctamente. Inicia sesiÃ³n nuevamente." });
        }

        // â”€â”€ 2FA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

            return Ok(new EstadoDosFactoresDto
            {
                Habilitado          = await _userManager.GetTwoFactorEnabledAsync(usuario),
                TieneConfiguracion  = !string.IsNullOrEmpty(llave)
            });
        }

        // POST api/auth/2fa/configurar â€” genera/renueva la clave TOTP y devuelve el URI
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

        // POST api/auth/2fa/activar â€” verifica el cÃ³digo y habilita 2FA
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
                return BadRequest(new { mensaje = "CÃ³digo incorrecto. Verifica que la hora de tu dispositivo estÃ© sincronizada." });

            await _userManager.SetTwoFactorEnabledAsync(usuario, true);

            return Ok(new { mensaje = "AutenticaciÃ³n de dos factores activada correctamente." });
        }

        // POST api/auth/2fa/desactivar â€” deshabilita 2FA
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
                return BadRequest(new { mensaje = "CÃ³digo incorrecto." });

            await _userManager.SetTwoFactorEnabledAsync(usuario, false);
            await _userManager.ResetAuthenticatorKeyAsync(usuario);

            return Ok(new { mensaje = "AutenticaciÃ³n de dos factores desactivada." });
        }

        // DELETE api/auth/cuenta â€” eliminar cuenta (anonimizaciÃ³n LFPDPPP)
        [Authorize]
        [HttpDelete("cuenta")]
        public async Task<IActionResult> EliminarCuenta([FromBody] EliminarCuentaDto dto)
        {
            var usuarioId = User.FindFirst("sub")?.Value;
            if (usuarioId is null) return Unauthorized();

            var usuario = await _userManager.FindByIdAsync(usuarioId);
            if (usuario is null) return NotFound();

            if (!await _userManager.CheckPasswordAsync(usuario, dto.Contrasena))
                return BadRequest(new { mensaje = "ContraseÃ±a incorrecta." });

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

            // Anonimizar datos personales (los registros histÃ³ricos se conservan sin PII)
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

        // POST api/auth/2fa/verificar â€” segundo factor durante el login
        [HttpPost("2fa/verificar")]
        [EnableRateLimiting("TwoFA")]
        public async Task<IActionResult> Verificar2FA([FromBody] VerificarDosFactoresDto dto)
        {
            var usuarioId = _jwtService.ValidarChallengeToken2FA(dto.ChallengeToken);
            if (usuarioId is null)
                return Unauthorized(new { mensaje = "Token de verificaciÃ³n invÃ¡lido o expirado. Inicia sesiÃ³n de nuevo." });

            var usuario = await _userManager.FindByIdAsync(usuarioId.Value.ToString());
            if (usuario is null || !usuario.Activo)
                return Unauthorized(new { mensaje = "Usuario no encontrado." });

            var codigoLimpio = dto.Codigo.Replace(" ", "").Replace("-", "");
            var valido = await _userManager.VerifyTwoFactorTokenAsync(
                usuario, _userManager.Options.Tokens.AuthenticatorTokenProvider, codigoLimpio);

            if (!valido)
                return Unauthorized(new { mensaje = "CÃ³digo incorrecto o expirado." });

            var roles = await _userManager.GetRolesAsync(usuario);
            var rol = roles.FirstOrDefault() ?? string.Empty;

            var token = _jwtService.GenerarToken(usuario, rol);
            var refreshToken = await _jwtService.GenerarRefreshTokenAsync(usuario.Id);

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
    }
}

