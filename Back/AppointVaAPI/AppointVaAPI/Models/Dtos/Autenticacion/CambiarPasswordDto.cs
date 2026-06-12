using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Autenticacion
{
    public class CambiarPasswordDto
    {
        [Required]
        public string PasswordActual { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        public string PasswordNuevo { get; set; } = string.Empty;
    }
}
