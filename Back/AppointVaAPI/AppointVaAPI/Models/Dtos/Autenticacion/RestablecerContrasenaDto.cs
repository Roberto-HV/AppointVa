using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Autenticacion
{
    public class RestablecerContrasenaDto
    {
        [Required, EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Token { get; set; } = string.Empty;

        [Required, MinLength(6)]
        public string NuevaContrasena { get; set; } = string.Empty;
    }
}
