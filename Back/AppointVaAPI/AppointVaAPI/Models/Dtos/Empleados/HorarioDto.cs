using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Empleados
{
    public class HorarioDto
    {
        public Guid? Id { get; set; }

        // 1=Lunes, 2=Martes, ..., 6=Sábado, 7=Domingo
        [Range(1, 7)]
        public byte DiaSemana { get; set; }

        // Formato "HH:mm", ej: "09:00"
        [Required]
        [RegularExpression(@"^\d{2}:\d{2}$", ErrorMessage = "Formato de hora inválido, use HH:mm")]
        public string HoraInicio { get; set; } = "09:00";

        [Required]
        [RegularExpression(@"^\d{2}:\d{2}$", ErrorMessage = "Formato de hora inválido, use HH:mm")]
        public string HoraFin { get; set; } = "18:00";

        public bool Activo { get; set; } = true;
    }
}
