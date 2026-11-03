using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AppointVaAPI.Constants;
using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;

namespace AppointVaAPI.Services
{
    /// <summary>
    /// Step-up ("sudo mode") for sensitive SuperAdmin actions (lote 5, G1): deleting a business,
    /// sending an owner a password link, and any payment or payment edit that leaves the business
    /// with permanent access (<see cref="Helpers.FacturacionAdmin.RequiereReautenticacion"/>).
    ///
    /// How it works:
    /// <list type="number">
    /// <item>POST api/auth/reautenticar checks the admin's password and current 2FA code and returns
    /// this proof. The admin must have 2FA on; the admin area sends them to set it up first, so the
    /// requirement can never strand the account.</item>
    /// <item>The front sends the proof in the <see cref="Encabezado"/> header, next to the normal
    /// session token, on each protected request. Endpoints opt in with
    /// <see cref="Filters.RequiereReautenticacionAttribute"/> (or call <see cref="ValidarAsync"/>).</item>
    /// </list>
    ///
    /// Why it cannot be bypassed by calling the API directly:
    /// <list type="bullet">
    /// <item>It is signed with the server key, so it cannot be forged, and it lasts
    /// <see cref="Duracion"/>.</item>
    /// <item>Its audience is <see cref="Audiencia"/>, not the session audience: JwtBearer rejects it
    /// as a session token, so it opens no endpoint on its own.</item>
    /// <item>It names the user it was issued to; a proof from another account does not count.</item>
    /// <item>It carries a hash of the security stamp. Changing the password or turning 2FA off or on
    /// rotates the stamp and voids every proof issued before.</item>
    /// </list>
    /// It is reusable until it expires, so one confirmation covers, for example, a delete retried
    /// after a network error. It is kept only in the front's memory, never in storage.
    /// </summary>
    public class ReautenticacionService : IReautenticacionService
    {
        /// <summary>Request header that carries the proof.</summary>
        public const string Encabezado = "X-Reautenticacion";

        /// <summary>How long a proof lasts.</summary>
        public static readonly TimeSpan Duracion = TimeSpan.FromMinutes(5);

        /// <summary>Marks the token's purpose; a session token never carries it.</summary>
        public const string ClaimProposito = "proposito";
        public const string Proposito = "reautenticacion";

        private readonly IConfiguration _config;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly TimeProvider _reloj;

        public ReautenticacionService(IConfiguration config, UserManager<ApplicationUser> userManager, TimeProvider reloj)
        {
            _config = config;
            _userManager = userManager;
            _reloj = reloj;
        }

        /// <summary>Distinct from Jwt:Audiencia so the bearer handler never accepts the proof as a session.</summary>
        private string Audiencia => $"{_config["Jwt:Audiencia"]}/{Proposito}";

        private SymmetricSecurityKey Clave => new(Encoding.UTF8.GetBytes(_config["Jwt:Clave"]!));

        public (string Token, DateTime Expiracion) Emitir(ApplicationUser usuario)
        {
            var ahora = _reloj.GetUtcNow().UtcDateTime;
            var expiracion = ahora.Add(Duracion);

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Emisor"],
                audience: Audiencia,
                claims:
                [
                    new Claim(ClaimsTipos.UsuarioId, usuario.Id.ToString()),
                    new Claim(ClaimProposito, Proposito),
                    new Claim(ClaimsTipos.ReautenticacionSello, JwtService.HashSello(usuario.SecurityStamp)),
                    new Claim("jti", Guid.NewGuid().ToString()),
                ],
                notBefore: ahora,
                expires: expiracion,
                signingCredentials: new SigningCredentials(Clave, SecurityAlgorithms.HmacSha256));

            return (new JwtSecurityTokenHandler().WriteToken(token), expiracion);
        }

        public async Task<bool> ValidarAsync(ClaimsPrincipal sesion, string? token)
        {
            if (string.IsNullOrWhiteSpace(token)) return false;
            var idSesion = sesion.FindFirst(ClaimsTipos.UsuarioId)?.Value;
            if (string.IsNullOrEmpty(idSesion)) return false;

            JwtSecurityToken jwt;
            try
            {
                new JwtSecurityTokenHandler { MapInboundClaims = false }.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = Clave,
                    ValidateIssuer = true,
                    ValidIssuer = _config["Jwt:Emisor"],
                    ValidateAudience = true,
                    ValidAudience = Audiencia,
                    ValidateLifetime = true,
                    LifetimeValidator = (_, expira, _, _) => expira.HasValue && expira.Value > _reloj.GetUtcNow().UtcDateTime,
                    ClockSkew = TimeSpan.Zero
                }, out var validado);
                jwt = (JwtSecurityToken)validado;
            }
            catch
            {
                return false;
            }

            if (jwt.Claims.FirstOrDefault(c => c.Type == ClaimProposito)?.Value != Proposito) return false;

            // Issued to the same account as the session making the request.
            var idPrueba = jwt.Claims.FirstOrDefault(c => c.Type == ClaimsTipos.UsuarioId)?.Value;
            if (!string.Equals(idPrueba, idSesion, StringComparison.OrdinalIgnoreCase)) return false;

            // A password or 2FA change since then rotated the stamp and voids the proof.
            var usuario = await _userManager.FindByIdAsync(idSesion);
            if (usuario is null || !usuario.Activo) return false;
            var sello = jwt.Claims.FirstOrDefault(c => c.Type == ClaimsTipos.ReautenticacionSello)?.Value;
            return sello == JwtService.HashSello(usuario.SecurityStamp);
        }
    }
}
