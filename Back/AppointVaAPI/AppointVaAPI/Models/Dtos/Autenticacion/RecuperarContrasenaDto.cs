using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Autenticacion
{
    public class RecuperarContrasenaDto
    {
        [Required, EmailAddress]
        public string Email { get; set; } = string.Empty;
    }
}
