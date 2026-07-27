using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace AppointVaAPI.Tests.Controllers.Integration;

public static class TestTokenHelper
{
    private const string Key      = "test-secret-key-32-chars-minimum-x";
    private const string Issuer   = "test-issuer";
    private const string Audience = "test-audience";

    public static string GenerarToken(string rol, Guid? negocioId = null, Guid? userId = null)
    {
        var uid = userId ?? Guid.NewGuid();
        var nid = negocioId ?? Guid.NewGuid();

        var claims = new[]
        {
            new Claim("sub",             uid.ToString()),
            new Claim("email",           $"test-{rol.ToLower()}@test.com"),
            new Claim("jti",             Guid.NewGuid().ToString()),
            new Claim("role",            rol),
            new Claim("nombre_completo", $"Test {rol}"),
            new Claim("negocio_id",      nid.ToString()),
        };

        var key  = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Key));
        var cred = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer:             Issuer,
            audience:           Audience,
            claims:             claims,
            expires:            DateTime.UtcNow.AddHours(1),
            signingCredentials: cred);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public static string Propietario(Guid? negocioId = null)  => GenerarToken("Propietario", negocioId);
    public static string Empleado(Guid? negocioId = null)     => GenerarToken("Empleado", negocioId);
    public static string SuperAdmin(Guid? negocioId = null)   => GenerarToken("SuperAdmin", negocioId);
}
