using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    public class HorarioEmpleado
    {
        [Key]
        public Guid Id { get; set; }
        [Required]
        public Guid EmpleadoId { get; set; }
        [ForeignKey("EmpleadoId")]
        public Empleado? Empleado { get; set; }
        [Required]
        public byte DiaSemana { get; set; }
        [Required]
        public TimeSpan HoraInicio { get; set; }
        [Required]
        public TimeSpan HoraFin { get; set; }
        [Required]
        public int Activo { get; set; }
    }
}
