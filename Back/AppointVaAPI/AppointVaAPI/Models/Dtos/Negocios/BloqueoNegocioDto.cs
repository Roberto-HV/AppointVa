using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Negocios
{
    public class BloqueoNegocioDto
    {
        public Guid Id { get; set; }
        public string Fecha { get; set; } = string.Empty;
        public string? Motivo { get; set; }
    }

    public class CrearBloqueoNegocioDto
    {
        [Required]
        public DateTime Fecha { get; set; }

        [MaxLength(300)]
        public string? Motivo { get; set; }
    }
}
