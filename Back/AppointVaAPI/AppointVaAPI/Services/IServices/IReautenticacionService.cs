using System.Security.Claims;
using AppointVaAPI.Models;

namespace AppointVaAPI.Services.IServices
{
    /// <summary>
    /// Step-up proof for sensitive SuperAdmin actions (lote 5, G1). See <see cref="ReautenticacionService"/>.
    /// </summary>
    public interface IReautenticacionService
    {
        /// <summary>Signs a short-lived proof that <paramref name="usuario"/> just confirmed their identity.</summary>
        (string Token, DateTime Expiracion) Emitir(ApplicationUser usuario);

        /// <summary>
        /// True when <paramref name="token"/> is a valid, unexpired proof issued to the same user as the
        /// session in <paramref name="sesion"/>, and the account's security stamp has not changed since.
        /// </summary>
        Task<bool> ValidarAsync(ClaimsPrincipal sesion, string? token);
    }
}
