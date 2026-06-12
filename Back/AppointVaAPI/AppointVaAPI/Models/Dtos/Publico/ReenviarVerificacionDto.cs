using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Publico
{
    public class ReenviarVerificacionDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
    }
}
