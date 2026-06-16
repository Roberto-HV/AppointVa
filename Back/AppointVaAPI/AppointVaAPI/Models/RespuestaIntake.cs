using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    public class RespuestaIntake
    {
        [Key]
        public Guid Id { get; set; }

        [Required]
        public Guid CitaId { get; set; }
        [ForeignKey("CitaId")]
        public Cita? Cita { get; set; }

        [Required]
        public Guid CampoIntakeId { get; set; }
        [ForeignKey("CampoIntakeId")]
        public CampoIntake? Campo { get; set; }

        public string? Valor { get; set; }
    }
}
