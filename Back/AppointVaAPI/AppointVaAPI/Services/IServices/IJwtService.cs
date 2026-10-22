using AppointVaAPI.Models;

namespace AppointVaAPI.Services.IServices
{
    public interface IJwtService
    {
        string GenerarToken(ApplicationUser usuario, string rol);
        Task<string> GenerarRefreshTokenAsync(Guid usuarioId);
        Task<RefreshToken?> ValidarRefreshTokenAsync(string token);
        Task RevocarRefreshTokenAsync(string token);
        Task RevocarTodosRefreshTokensAsync(Guid usuarioId);

        /// <summary>
        /// Reception-screen JWT (B9): role <c>Kiosco</c>, bound to the user's negocio and
        /// security stamp, no refresh token. Returns the token and its UTC expiry.
        /// </summary>
        (string Token, DateTime Expiracion) GenerarTokenKiosco(ApplicationUser usuario, string rolOrigen, TimeSpan duracion);

        // 2FA challenge: JWT de vida corta para el segundo factor
        string GenerarChallengeToken2FA(Guid usuarioId);
        Guid? ValidarChallengeToken2FA(string token);
    }
}
