using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Empleados
{
    public class CrearEmpleadoDto
    {
        [Required(ErrorMessage = "El nombre es obligatorio")]
        [MaxLength(150)]
        public string Nombre { get; set; } = string.Empty;

        [MaxLength(20)]
        public string? Telefono { get; set; }

        [EmailAddress(ErrorMessage = "Formato de correo inválido")]
        [MaxLength(150)]
        public string? Email { get; set; }

        [MaxLength(500)]
        public string? Biografia { get; set; }

        public List<Guid> ServicioIds { get; set; } = [];
    }
}
