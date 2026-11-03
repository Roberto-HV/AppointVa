namespace AppointVaAPI.Models.Dtos.Autenticacion
{
    /// <summary>Lote 5 (G1): password plus the current 2FA code, before a sensitive admin action.</summary>
    public class ReautenticarDto
    {
        public string Contrasena { get; set; } = string.Empty;

        /// <summary>Code from the authenticator app (or a recovery code, which is then spent).</summary>
        public string? Codigo { get; set; }
    }

    public class ReautenticacionRespuestaDto
    {
        public string Token { get; set; } = string.Empty;
        public DateTime Expiracion { get; set; }
    }
}
