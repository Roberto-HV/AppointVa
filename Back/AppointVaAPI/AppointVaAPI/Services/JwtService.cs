using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace AppointVaAPI.Services
{
    public class JwtService : IJwtService
    {
        private readonly IConfiguration _config;
        private readonly ApplicationDbContext _db;

        public JwtService(IConfiguration config, ApplicationDbContext db)
        {
            _config = config;
            _db = db;
        }

        public string GenerarToken(ApplicationUser usuario, string rol)
        {
            var clave = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Clave"]!));
            var credenciales = new SigningCredentials(clave, SecurityAlgorithms.HmacSha256);
            var expiracion = DateTime.UtcNow.AddMinutes(int.Parse(_config["Jwt:ExpiracionMinutos"]!));

            var claims = new[]
            {
                new Claim(ClaimsTipos.UsuarioId, usuario.Id.ToString()),
                new Claim("email", usuario.Email!),
                new Claim("jti", Guid.NewGuid().ToString()),
                new Claim(ClaimsTipos.Rol, rol),
                new Claim(ClaimsTipos.NombreCompleto, $"{usuario.Nombre} {usuario.Apellido}".Trim()),
                new Claim(ClaimsTipos.NegocioId, usuario.NegocioId?.ToString() ?? string.Empty)
            };

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Emisor"],
                audience: _config["Jwt:Audiencia"],
                claims: claims,
                expires: expiracion,
                signingCredentials: credenciales
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public async Task<string> GenerarRefreshTokenAsync(Guid usuarioId)
        {
            var tokenAleatorio = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
            var diasExpiracion = int.Parse(_config["Jwt:RefreshExpiracionDias"]!);

            var refreshToken = new RefreshToken
            {
                Id = Guid.NewGuid(),
                Token = tokenAleatorio,
                UsuarioId = usuarioId,
                FechaExpiracion = DateTime.UtcNow.AddDays(diasExpiracion),
                FechaCreacion = DateTime.UtcNow,
                Usado = false,
                Revocado = false
            };

            await _db.RefreshTokens.AddAsync(refreshToken);
            await _db.SaveChangesAsync();

            return tokenAleatorio;
        }

        public async Task<RefreshToken?> ValidarRefreshTokenAsync(string token)
        {
            var refreshToken = await _db.RefreshTokens
                .Include(rt => rt.Usuario)
                .FirstOrDefaultAsync(rt => rt.Token == token);

            if (refreshToken is null) return null;
            if (refreshToken.Revocado || refreshToken.Usado) return null;
            if (refreshToken.FechaExpiracion < DateTime.UtcNow) return null;

            return refreshToken;
        }

        public async Task RevocarRefreshTokenAsync(string token)
        {
            var refreshToken = await _db.RefreshTokens
                .FirstOrDefaultAsync(rt => rt.Token == token);

            if (refreshToken is not null)
            {
                refreshToken.Revocado = true;
                await _db.SaveChangesAsync();
            }
        }

        public async Task RevocarTodosRefreshTokensAsync(Guid usuarioId)
        {
            var tokens = await _db.RefreshTokens
                .Where(rt => rt.UsuarioId == usuarioId && !rt.Revocado)
                .ToListAsync();

            foreach (var token in tokens)
                token.Revocado = true;

            await _db.SaveChangesAsync();
        }

        public string GenerarChallengeToken2FA(Guid usuarioId)
        {
            var clave = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Clave"]!));
            var credenciales = new SigningCredentials(clave, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimsTipos.UsuarioId, usuarioId.ToString()),
                new Claim("2fa_challenge", "true"),
                new Claim("jti", Guid.NewGuid().ToString())
            };

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Emisor"],
                audience: _config["Jwt:Audiencia"],
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(5),
                signingCredentials: credenciales
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public Guid? ValidarChallengeToken2FA(string token)
        {
            try
            {
                var handler = new JwtSecurityTokenHandler();
                var clave = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Clave"]!));

                handler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = clave,
                    ValidateIssuer = true,
                    ValidIssuer = _config["Jwt:Emisor"],
                    ValidateAudience = true,
                    ValidAudience = _config["Jwt:Audiencia"],
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero
                }, out var tokenValidado);

                var jwt = (JwtSecurityToken)tokenValidado;
                var esChallenge = jwt.Claims.FirstOrDefault(c => c.Type == "2fa_challenge")?.Value == "true";
                if (!esChallenge) return null;

                var idStr = jwt.Claims.FirstOrDefault(c => c.Type == ClaimsTipos.UsuarioId)?.Value;
                return Guid.TryParse(idStr, out var id) ? id : null;
            }
            catch
            {
                return null;
            }
        }
    }
}
