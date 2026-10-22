namespace AppointVaAPI.Models.Dtos.Autenticacion
{
    public class LoginRespuestaDto
    {
        public string Token { get; set; } = string.Empty;
        public DateTime TokenExpiracion { get; set; }
        public string RefreshToken { get; set; } = string.Empty;
        public UsuarioInfoDto Usuario { get; set; } = new();

        // Presente solo cuando el usuario tiene 2FA habilitado
        public bool Requiere2FA { get; set; }
        public string? ChallengeToken { get; set; }

        /// <summary>B8: set only when the second factor was a recovery code (codes left after it).</summary>
        public int? CodigosRecuperacionRestantes { get; set; }
    }
}
