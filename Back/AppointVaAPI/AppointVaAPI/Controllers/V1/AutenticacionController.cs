using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Autenticacion;
using AppointVaAPI.Services.IServices;
using AppointVaAPI.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

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

        public AutenticacionController(
            UserManager<ApplicationUser> userManager,
            IJwtService jwtService,
            IEmailService email,
            IConfiguration config)
        {
            _userManager = userManager;
            _jwtService = jwtService;
            _email = email;
            _config = config;
        }

        // POST api/auth/login
        [HttpPost("login")]
        [EnableRateLimiting("Auth")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            var usuario = await _userManager.FindByEmailAsync(dto.Email);
            if (usuario is null || !usuario.Activo)
                return Unauthorized(new { mensaje = "Credenciales inválidas" });

            if (!await _userManager.CheckPasswordAsync(usuario, dto.Contrasena))
                return Unauthorized(new { mensaje = "Credenciales inválidas" });

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
                    NegocioId = usuario.NegocioId
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
                    NegocioId = usuario.NegocioId
                }
            });
        }

        // POST api/auth/logout
        [Authorize]
        [HttpPost("logout")]
        public async Task<IActionResult> Logout([FromBody] RefrescarTokenDto dto)
        {
            await _jwtService.RevocarRefreshTokenAsync(dto.RefreshToken);
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
                NegocioId = usuario.NegocioId
            });
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
                var frontendUrl = _config["FrontendUrl"] ?? "http://localhost:5173";
                var urlReset = $"{frontendUrl}/restablecer-contrasena?token={tokenEncoded}&email={Uri.EscapeDataString(dto.Email)}";

                _ = Task.Run(async () =>
                    await _email.EnviarRecuperacionContrasenaAsync(dto.Email, usuario.Nombre, urlReset));
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

            return Ok(new { mensaje = "Contraseña actualizada correctamente. Inicia sesión nuevamente." });
        }

        // ── 2FA ──────────────────────────────────────────────────────────────────

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

            return Ok(new { mensaje = "Autenticación de dos factores activada correctamente." });
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

            return Ok(new { mensaje = "Autenticación de dos factores desactivada." });
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
            if (usuario is null || !usuario.Activo)
                return Unauthorized(new { mensaje = "Usuario no encontrado." });

            var codigoLimpio = dto.Codigo.Replace(" ", "").Replace("-", "");
            var valido = await _userManager.VerifyTwoFactorTokenAsync(
                usuario, _userManager.Options.Tokens.AuthenticatorTokenProvider, codigoLimpio);

            if (!valido)
                return Unauthorized(new { mensaje = "Código incorrecto o expirado." });

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
                    NegocioId = usuario.NegocioId
                }
            });
        }
    }
}
