using Hangfire.Dashboard;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Text;

namespace AppointVaAPI.Filters;

public class HangfireAuthorizationFilter : IDashboardAuthorizationFilter
{
    private readonly IConfiguration _config;

    public HangfireAuthorizationFilter(IConfiguration config)
    {
        _config = config;
    }

    public bool Authorize(DashboardContext context)
    {
        var http = context.GetHttpContext();
        var token = http.Request.Cookies["hangfire_auth"];
        if (string.IsNullOrEmpty(token)) return false;

        try
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Clave"]!));
            var principal = new JwtSecurityTokenHandler().ValidateToken(token,
                new TokenValidationParameters
                {
                    ValidateIssuer           = true,
                    ValidateAudience         = true,
                    ValidateLifetime         = true,
                    ValidateIssuerSigningKey  = true,
                    ValidIssuer              = _config["Jwt:Emisor"],
                    ValidAudience            = _config["Jwt:Audiencia"],
                    IssuerSigningKey         = key,
                    RoleClaimType            = "role",
                    NameClaimType            = "sub",
                    ClockSkew                = TimeSpan.Zero,
                }, out _);

            return principal.IsInRole("SuperAdmin");
        }
        catch
        {
            return false;
        }
    }
}
