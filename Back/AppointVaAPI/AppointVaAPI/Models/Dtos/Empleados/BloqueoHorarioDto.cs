using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Empleados
{
    public class BloqueoHorarioDto
    {
        public Guid? Id { get; set; }

        [Required(ErrorMessage = "La fecha de inicio es obligatoria")]
        public DateTime InicioEn { get; set; }

        [Required(ErrorMessage = "La fecha de fin es obligatoria")]
        public DateTime FinEn { get; set; }

        [MaxLength(300)]
        public string? Motivo { get; set; }
    }
}
