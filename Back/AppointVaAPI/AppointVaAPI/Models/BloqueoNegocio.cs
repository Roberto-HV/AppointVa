using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    public class BloqueoNegocio
    {
        [Key]
        public Guid Id { get; set; }

        [Required]
        public Guid NegocioId { get; set; }
        [ForeignKey("NegocioId")]
        public Negocio? Negocio { get; set; }

        [Required]
        public DateTime Fecha { get; set; }

        [MaxLength(300)]
        public string? Motivo { get; set; }

        [Required]
        public DateTime FechaCreacion { get; set; }
    }
}
