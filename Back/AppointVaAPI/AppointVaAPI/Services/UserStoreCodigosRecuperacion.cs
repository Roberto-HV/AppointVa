using System.Security.Cryptography;
using System.Text;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;

namespace AppointVaAPI.Services
{
    /// <summary>
    /// B8 / decision 9: Identity's stock store keeps 2FA recovery codes as plain text
    /// (joined with ';' in AspNetUserTokens, "[AspNetUserStore]" / "RecoveryCodes").
    /// This store keeps the same row but writes one salted PBKDF2 hash per code, so a
    /// database leak does not hand out working codes. UserManager's own
    /// GenerateNewTwoFactorRecoveryCodesAsync / RedeemTwoFactorRecoveryCodeAsync /
    /// CountRecoveryCodesAsync keep working unchanged on top of it.
    /// </summary>
    public class UserStoreCodigosRecuperacion
        : UserStore<ApplicationUser, IdentityRole<Guid>, ApplicationDbContext, Guid>
    {
        // Same provider/name as Identity's UserStoreBase, so the existing row is reused.
        public const string ProveedorInterno = "[AspNetUserStore]";
        public const string NombreToken = "RecoveryCodes";

        // Codes carry ~47 bits of entropy: a salted, slow hash keeps an offline guess
        // from a leaked row expensive. 10 codes x this cost stays well under a second.
        private const int Iteraciones = 100_000;
        private const int BytesSal = 16;
        private const int BytesHash = 32;

        public UserStoreCodigosRecuperacion(ApplicationDbContext context, IdentityErrorDescriber? describer = null)
            : base(context, describer) { }

        public override Task ReplaceCodesAsync(ApplicationUser user, IEnumerable<string> recoveryCodes, CancellationToken cancellationToken)
        {
            var hashes = recoveryCodes.Select(Hashear);
            return SetTokenAsync(user, ProveedorInterno, NombreToken, string.Join(";", hashes), cancellationToken);
        }

        public override async Task<bool> RedeemCodeAsync(ApplicationUser user, string code, CancellationToken cancellationToken)
        {
            ArgumentNullException.ThrowIfNull(user);
            if (string.IsNullOrWhiteSpace(code)) return false;

            var guardados = await LeerAsync(user, cancellationToken);
            var coincidencia = guardados.FirstOrDefault(h => Coincide(h, code));
            if (coincidencia is null) return false;

            // Written directly (not through ReplaceCodesAsync) so the remaining hashes are
            // not hashed a second time. Saved together with the user's concurrency stamp by
            // UserManager.UpdateUserAsync: two parallel redemptions cannot both succeed.
            var restantes = guardados.Where(h => !ReferenceEquals(h, coincidencia));
            await SetTokenAsync(user, ProveedorInterno, NombreToken, string.Join(";", restantes), cancellationToken);
            return true;
        }

        public override async Task<int> CountCodesAsync(ApplicationUser user, CancellationToken cancellationToken)
            => (await LeerAsync(user, cancellationToken)).Count;

        private async Task<List<string>> LeerAsync(ApplicationUser user, CancellationToken ct)
        {
            var unidos = await GetTokenAsync(user, ProveedorInterno, NombreToken, ct) ?? string.Empty;
            return unidos.Split(';', StringSplitOptions.RemoveEmptyEntries).ToList();
        }

        /// <summary>Codes are shown as "XXXXX-XXXXX"; case, spaces and dashes do not matter.</summary>
        public static string Normalizar(string codigo) =>
            new string(codigo.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();

        public static string Hashear(string codigo)
        {
            var sal = RandomNumberGenerator.GetBytes(BytesSal);
            var hash = Derivar(Normalizar(codigo), sal);
            return $"{Convert.ToBase64String(sal)}:{Convert.ToBase64String(hash)}";
        }

        public static bool Coincide(string guardado, string codigo)
        {
            var partes = guardado.Split(':');
            if (partes.Length != 2) return false;
            try
            {
                var sal = Convert.FromBase64String(partes[0]);
                var esperado = Convert.FromBase64String(partes[1]);
                return CryptographicOperations.FixedTimeEquals(esperado, Derivar(Normalizar(codigo), sal));
            }
            catch (FormatException)
            {
                return false;
            }
        }

        private static byte[] Derivar(string normalizado, byte[] sal) =>
            Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(normalizado), sal, Iteraciones, HashAlgorithmName.SHA256, BytesHash);
    }
}
