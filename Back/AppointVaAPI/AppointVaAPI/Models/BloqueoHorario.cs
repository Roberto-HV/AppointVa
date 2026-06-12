using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    public class BloqueoHorario
    {
        [Key]
        public Guid Id { get; set; }
        [Required]
        public Guid EmpleadoId { get; set; }
        [ForeignKey("EmpleadoId")]
        public Empleado? Empleado { get; set; }
        [Required]
        public DateTime InicioEn { get; set; }
        [Required]
        public DateTime FinEn { get; set; }
        public string? Motivo { get; set; }
        [Required]
        public DateTime FechaCreacion { get; set; }
    }
}
