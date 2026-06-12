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

        // 2FA challenge: JWT de vida corta para el segundo factor
        string GenerarChallengeToken2FA(Guid usuarioId);
        Guid? ValidarChallengeToken2FA(string token);
    }
}
