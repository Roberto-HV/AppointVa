using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Autenticacion
{
    public class EstadoDosFactoresDto
    {
        public bool Habilitado { get; set; }
        public bool TieneConfiguracion { get; set; }
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
        [Required]
        public string Codigo { get; set; } = string.Empty;
    }
}
