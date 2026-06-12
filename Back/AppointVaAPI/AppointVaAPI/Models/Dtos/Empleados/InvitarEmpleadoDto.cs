using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Empleados
{
    public class InvitarEmpleadoDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        public string Password { get; set; } = string.Empty;
    }
}
