using System.Globalization;
using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Helpers;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Autenticacion;
using AppointVaAPI.Models.Dtos.Kiosco;
using AppointVaAPI.Services;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Controllers.V1
{
    /// <summary>
    /// Reception screen ("modo recepción", B9 / decision 3).
    /// The signed-in owner or employee trades their session for a restricted kiosk JWT
    /// (12 h, no refresh token) that can only read today's agenda and ask to leave.
    /// Leaving checks the opener's password without touching the Identity lockout and
    /// has its own limit of 3 attempts per 5 minutes per negocio.
    /// </summary>
    [ApiController]
    [Route("api/kiosco")]
    public class KioscoController : ControllerBase
    {
        public static readonly TimeSpan DuracionToken = TimeSpan.FromHours(12);

        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IJwtService _jwt;
        private readonly IAuditService _audit;
        private readonly IKioscoSalidaLimitador _limitador;
        private readonly ApplicationDbContext _db;
        private readonly TimeProvider _reloj;

        public KioscoController(
            UserManager<ApplicationUser> userManager,
            IJwtService jwt,
            IAuditService audit,
            IKioscoSalidaLimitador limitador,
            ApplicationDbContext db,
            TimeProvider reloj)
        {
            _userManager = userManager;
            _jwt = jwt;
            _audit = audit;
            _limitador = limitador;
            _db = db;
            _reloj = reloj;
        }

        public const string AccionSalidaFallida = "KioscoSalidaFallida";
        public const string AccionSalidaBloqueada = "KioscoSalidaBloqueada";

        /// <summary>Per-IP ASP.NET rate limit policy for POST api/kiosco/salir (see Program.cs).</summary>
        public const string PoliticaLimiteSalida = "KioscoSalida";

        // POST api/kiosco/sesion — a normal session asks for a kiosk token
        [HttpPost("sesion")]
        [Authorize(Roles = $"{Roles.Propietario},{Roles.Empleado}")]
        public async Task<IActionResult> Iniciar([FromBody] IniciarKioscoDto? dto)
        {
            var usuario = await _userManager.FindByIdAsync(User.FindFirst(ClaimsTipos.UsuarioId)?.Value ?? string.Empty);
            if (usuario is null || !usuario.Activo || usuario.NegocioId is null) return Unauthorized();
            // A still-valid access token of a just-deactivated employee cannot open a kiosk.
            if (await AccesoEmpleadoHelper.AccesoBloqueadoAsync(_db, _userManager, usuario)) return Unauthorized();

            // The role comes from the database, not from the (up to an hour old) access token.
            var rol = (await _userManager.GetRolesAsync(usuario))
                .FirstOrDefault(r => r is Roles.Propietario or Roles.Empleado);
            if (rol is null) return Forbid();

            // An employee's screen only shows their own appointments: without an Empleado
            // record it would have nothing to show, so it is refused up front with a reason.
            if (rol == Roles.Empleado && await EmpleadoDelUsuarioAsync(usuario.Id, usuario.NegocioId.Value) is null)
                return SinFichaDeEmpleado();

            var (token, expiracion) = _jwt.GenerarTokenKiosco(usuario, rol, DuracionToken);

            // The device keeps nothing that can restore the opener's session: their refresh
            // token is revoked here (only when it is theirs), and the front drops it too.
            if (!string.IsNullOrWhiteSpace(dto?.RefreshToken))
            {
                var refresh = await _db.RefreshTokens.FirstOrDefaultAsync(
                    rt => rt.Token == dto.RefreshToken && rt.UsuarioId == usuario.Id);
                if (refresh is not null)
                {
                    refresh.Revocado = true;
                    await _db.SaveChangesAsync();
                }
            }

            await _audit.RegistrarAsync("KioscoIniciado", "Negocio", usuario.NegocioId.ToString(), $"Rol: {rol}", usuario.Id);

            return Ok(new SesionKioscoDto
            {
                Token = token,
                TokenExpiracion = expiracion,
                Usuario = new UsuarioInfoDto
                {
                    Id = usuario.Id,
                    Email = usuario.Email!,
                    NombreCompleto = $"{usuario.Nombre} {usuario.Apellido}".Trim(),
                    Rol = Roles.Kiosco,
                    NegocioId = usuario.NegocioId,
                    FotoUrl = usuario.FotoUrl
                }
            });
        }

        // GET api/kiosco/agenda — today's appointments in the negocio's time zone
        [HttpGet("agenda")]
        [Authorize(Policy = Politicas.Kiosco)]
        public async Task<IActionResult> Agenda()
        {
            var sesion = await ValidarSesionAsync();
            if (sesion is null) return Unauthorized(new { mensaje = "La sesión de recepción ya no es válida." });
            var (_, negocioId, rolOrigen) = sesion.Value;

            var negocio = await _db.Negocios.AsNoTracking()
                .Where(n => n.Id == negocioId && n.FechaEliminacion == null)
                .Select(n => new { n.Nombre, n.Sector, n.ZonaHoraria })
                .FirstOrDefaultAsync();
            if (negocio is null) return NotFound();

            // Same rule as GET api/citas: an employee only sees their own appointments.
            Guid? soloEmpleado = null;
            if (rolOrigen == Roles.Empleado)
            {
                soloEmpleado = await EmpleadoDelUsuarioAsync(sesion.Value.Usuario.Id, negocioId);
                if (soloEmpleado is null) return SinFichaDeEmpleado();
            }

            var hoy = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ZonaHorariaHelper.Resolver(negocio.ZonaHoraria)).Date;
            var manana = hoy.AddDays(1);
            var mostrarIngresos = rolOrigen == Roles.Propietario;

            var citas = await _db.Citas.AsNoTracking()
                .Where(c => c.NegocioId == negocioId && c.InicioEn >= hoy && c.InicioEn < manana)
                .Where(c => soloEmpleado == null || c.EmpleadoId == soloEmpleado)
                .OrderBy(c => c.InicioEn)
                .Select(c => new
                {
                    c.Id, c.EmpleadoId, c.InicioEn, c.FinEn, c.Estado, c.Precio, c.Pagada,
                    Cliente = c.Cliente!.NombreCompleto,
                    Servicio = c.Servicio!.Nombre,
                    Duracion = c.Servicio.DuracionMinutos
                })
                .ToListAsync();

            var empleados = await _db.Empleados.AsNoTracking()
                .Where(e => e.NegocioId == negocioId && e.Activo == 1 && e.FechaEliminacion == null)
                .OrderBy(e => e.Nombre)
                .Select(e => new EmpleadoKioscoDto { Id = e.Id, Nombre = e.Nombre })
                .ToListAsync();

            Response.Headers.CacheControl = "no-store";
            return Ok(new AgendaKioscoDto
            {
                NombreNegocio = negocio.Nombre,
                Sector = negocio.Sector,
                MostrarIngresos = mostrarIngresos,
                Empleados = empleados,
                Citas = citas.Select(c => new CitaKioscoDto
                {
                    Id = c.Id,
                    EmpleadoId = c.EmpleadoId,
                    NombreCliente = NombreConInicial(c.Cliente),
                    NombreServicio = c.Servicio,
                    DuracionMinutos = c.Duracion,
                    Precio = mostrarIngresos ? c.Precio : 0,
                    Pagada = mostrarIngresos && c.Pagada,
                    InicioEn = c.InicioEn,
                    FinEn = c.FinEn,
                    EstadoTexto = PublicoController.ObtenerEstadoTexto(c.Estado),
                }).ToList()
            });
        }

        // POST api/kiosco/salir — the opener's password trades the kiosk token for a normal session
        [HttpPost("salir")]
        [Authorize(Policy = Politicas.Kiosco)]
        [EnableRateLimiting(PoliticaLimiteSalida)]
        public async Task<IActionResult> Salir([FromBody] SalirKioscoDto dto)
        {
            var sesion = await ValidarSesionAsync();
            if (sesion is null) return Unauthorized(new { mensaje = "La sesión de recepción ya no es válida. Inicia sesión de nuevo." });
            var (usuario, negocioId, _) = sesion.Value;

            // Already blocked in memory: answer without reading the audit log.
            if (_limitador.Restantes(negocioId, out var espera) == 0)
                return await SalidaBloqueadaAsync(negocioId, usuario.Id, espera);

            // The attempt is spent before the password is checked, so parallel guesses
            // cannot get past the limit.
            if (!_limitador.Intentar(negocioId, await FallosRecientesAsync(negocioId), out espera))
                return await SalidaBloqueadaAsync(negocioId, usuario.Id, espera);

            // Identity's lockout is respected but never fed from here: CheckPasswordAsync
            // does not touch AccessFailedCount (only AccessFailedAsync does).
            if (await _userManager.IsLockedOutAsync(usuario))
                return StatusCode(403, new { mensaje = "La cuenta está bloqueada temporalmente. Inténtalo más tarde.", codigoError = CodigoCuentaBloqueada });

            if (!await _userManager.CheckPasswordAsync(usuario, dto.Contrasena ?? string.Empty))
            {
                await _audit.RegistrarAsync(AccionSalidaFallida, "Negocio", negocioId.ToString(), "Contraseña incorrecta", usuario.Id);
                var restantes = _limitador.Restantes(negocioId, out var esperaTrasFallo);
                if (restantes == 0) return DemasiadosIntentos(esperaTrasFallo);
                return BadRequest(new { mensaje = "Contraseña incorrecta.", codigoError = CodigoContrasenaIncorrecta, intentosRestantes = restantes });
            }

            // The right password does not count against the budget for wrong guesses.
            _limitador.Reembolsar(negocioId);

            var roles = await _userManager.GetRolesAsync(usuario);
            var rol = roles.FirstOrDefault() ?? string.Empty;

            // Same answer as POST /api/auth/login: with 2FA the front finishes through
            // /api/auth/2fa/verificar, which has its own limit.
            if (await _userManager.GetTwoFactorEnabledAsync(usuario))
            {
                await _audit.RegistrarAsync("KioscoSalida", "Negocio", negocioId.ToString(), "Contraseña correcta; falta 2FA", usuario.Id);
                return Ok(new LoginRespuestaDto
                {
                    Requiere2FA = true,
                    ChallengeToken = _jwt.GenerarChallengeToken2FA(usuario.Id)
                });
            }

            var token = _jwt.GenerarToken(usuario, rol);
            var refreshToken = await _jwt.GenerarRefreshTokenAsync(usuario.Id);
            await _audit.RegistrarAsync("KioscoSalida", "Negocio", negocioId.ToString(), usuarioId: usuario.Id);

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

        public const string CodigoContrasenaIncorrecta = "CONTRASENA_INCORRECTA";
        public const string CodigoDemasiadosIntentos = "DEMASIADOS_INTENTOS";
        public const string CodigoCuentaBloqueada = "CUENTA_BLOQUEADA";
        public const string CodigoEmpleadoNoVinculado = "EMPLEADO_NO_VINCULADO";

        private Task<Guid?> EmpleadoDelUsuarioAsync(Guid usuarioId, Guid negocioId) =>
            _db.Empleados.AsNoTracking()
                .Where(e => e.NegocioId == negocioId && e.UsuarioId == usuarioId && e.FechaEliminacion == null)
                .Select(e => (Guid?)e.Id)
                .FirstOrDefaultAsync();

        private ObjectResult SinFichaDeEmpleado() => StatusCode(403, new
        {
            mensaje = "Tu usuario no está vinculado a ningún empleado de este negocio. Pide al propietario que te vincule para usar el modo recepción.",
            codigoError = CodigoEmpleadoNoVinculado
        });

        /// <summary>
        /// The negocio's failed exits inside the limiter window, read from the audit log so the
        /// budget survives restarts and is shared between instances (no extra table needed).
        /// </summary>
        private async Task<IReadOnlyCollection<DateTimeOffset>> FallosRecientesAsync(Guid negocioId)
        {
            var zona = ZonaHorariaHelper.Resolver(AuditService.ZonaHorariaRegistro);
            var desde = TimeZoneInfo.ConvertTimeFromUtc((_reloj.GetUtcNow() - KioscoSalidaLimitador.Ventana).UtcDateTime, zona);
            var entidadId = negocioId.ToString();
            var fechas = await _db.AuditLogs.AsNoTracking()
                .Where(a => a.Accion == AccionSalidaFallida && a.Entidad == "Negocio" && a.EntidadId == entidadId && a.FechaEn >= desde)
                .Select(a => a.FechaEn)
                .ToListAsync();
            return fechas
                .Select(f => new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(f, DateTimeKind.Unspecified), zona)))
                .ToList();
        }

        /// <summary>
        /// 429 for a blocked exit. The block is audited once (its first rejected request), not on
        /// every retry, so hammering the endpoint does not write a row per request.
        /// </summary>
        private async Task<ObjectResult> SalidaBloqueadaAsync(Guid negocioId, Guid usuarioId, TimeSpan espera)
        {
            if (_limitador.AvisarBloqueo(negocioId, espera))
                await _audit.RegistrarAsync(AccionSalidaBloqueada, "Negocio", negocioId.ToString(), usuarioId: usuarioId);
            return DemasiadosIntentos(espera);
        }

        private ObjectResult DemasiadosIntentos(TimeSpan espera)
        {
            var segundos = (int)Math.Ceiling(Math.Max(1, espera.TotalSeconds));
            Response.Headers.RetryAfter = segundos.ToString(CultureInfo.InvariantCulture);
            // The body repeats it: the front is cross-origin and Retry-After is not CORS-exposed.
            return StatusCode(429, new
            {
                mensaje = "Demasiados intentos incorrectos. Espera unos minutos.",
                codigoError = CodigoDemasiadosIntentos,
                reintentarEnSegundos = segundos
            });
        }

        /// <summary>
        /// The kiosk token is stateless, so each request re-checks that its user still exists,
        /// is active, belongs to the token's negocio and has the same security stamp
        /// (a password change or reset ends every open kiosk).
        /// </summary>
        private async Task<(ApplicationUser Usuario, Guid NegocioId, string RolOrigen)?> ValidarSesionAsync()
        {
            if (!Guid.TryParse(User.FindFirst(ClaimsTipos.NegocioId)?.Value, out var negocioId)) return null;
            var usuario = await _userManager.FindByIdAsync(User.FindFirst(ClaimsTipos.UsuarioId)?.Value ?? string.Empty);
            if (usuario is null || !usuario.Activo || usuario.NegocioId != negocioId) return null;
            if (User.FindFirst(ClaimsTipos.KioscoSello)?.Value != JwtService.SelloKiosco(usuario.SecurityStamp)) return null;

            var rolOrigen = User.FindFirst(ClaimsTipos.KioscoRolOrigen)?.Value;
            if (rolOrigen is not (Roles.Propietario or Roles.Empleado)) return null;
            // The opener must still hold that role.
            if (!await _userManager.IsInRoleAsync(usuario, rolOrigen)) return null;
            return (usuario, negocioId, rolOrigen);
        }

        private static readonly HashSet<string> ParticulasApellido =
            new(["de", "del", "la", "las", "los", "y"], StringComparer.OrdinalIgnoreCase);

        /// <summary>
        /// "María García López" → "María G."; mirrors nombreConInicial in
        /// Front/src/utils/formatters.ts so the full name never reaches the screen.
        /// </summary>
        public static string NombreConInicial(string? nombreCompleto)
        {
            var partes = (nombreCompleto ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            if (partes.Length == 0) return string.Empty;
            if (partes.Length == 1) return partes[0];
            var apellido = partes.Skip(1).FirstOrDefault(p => !ParticulasApellido.Contains(p));
            if (apellido is null) return partes[0];
            return $"{partes[0]} {char.ToUpper(apellido[0], CultureInfo.GetCultureInfo("es-MX"))}.";
        }
    }
}
