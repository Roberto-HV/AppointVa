using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Negocios
{
    public class CrearPropietarioDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        public string Password { get; set; } = string.Empty;

        [Required]
        [MaxLength(80)]
        public string Nombre { get; set; } = string.Empty;

        [MaxLength(80)]
        public string Apellido { get; set; } = string.Empty;
    }
}
