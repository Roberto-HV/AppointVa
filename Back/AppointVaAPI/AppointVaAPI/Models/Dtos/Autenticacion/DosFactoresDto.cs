using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Autenticacion
{
    public class EstadoDosFactoresDto
    {
        public bool Habilitado { get; set; }
        public bool TieneConfiguracion { get; set; }
        /// <summary>B8: unused recovery codes (0 while 2FA is off).</summary>
        public int CodigosRecuperacionRestantes { get; set; }
    }

    /// <summary>B8: the plain codes, returned once (activation or regeneration) and never again.</summary>
    public class CodigosRecuperacionDto
    {
        public string Mensaje { get; set; } = string.Empty;
        public IReadOnlyList<string> CodigosRecuperacion { get; set; } = [];
    }

    /// <summary>B8: regenerating the codes needs the password or a current authenticator code.</summary>
    public class RegenerarCodigosRecuperacionDto
    {
        public string? Contrasena { get; set; }
        public string? Codigo { get; set; }
    }

    public class ConfigurarDosFactoresRespuestaDto
    {
        public string Uri { get; set; } = string.Empty;
        public string Llave { get; set; } = string.Empty;
    }

    public class ActivarDosFactoresDto
    {
        [Required]
        public string Codigo { get; set; } = string.Empty;
    }

    public class VerificarDosFactoresDto
    {
        [Required]
        public string ChallengeToken { get; set; } = string.Empty;
        /// <summary>Authenticator (TOTP) code. Not needed when <see cref="CodigoRecuperacion"/> is sent.</summary>
        public string Codigo { get; set; } = string.Empty;
        /// <summary>B8: a one-time recovery code instead of the authenticator code.</summary>
        public string? CodigoRecuperacion { get; set; }
    }
}
