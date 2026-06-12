using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Negocios
{
    public class RegistroNegocioDto
    {
        [Required(ErrorMessage = "El nombre del negocio es obligatorio")]
        [MaxLength(150)]
        public string NombreNegocio { get; set; } = string.Empty;

        [Required(ErrorMessage = "El identificador (slug) es obligatorio")]
        [MaxLength(80)]
        [RegularExpression(@"^[a-z0-9\-]+$", ErrorMessage = "Solo minúsculas, números y guiones")]
        public string Slug { get; set; } = string.Empty;

        [Required(ErrorMessage = "Tu nombre es obligatorio")]
        [MaxLength(150)]
        public string NombrePropietario { get; set; } = string.Empty;

        [Required(ErrorMessage = "El correo es obligatorio")]
        [EmailAddress(ErrorMessage = "Correo inválido")]
        [MaxLength(150)]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "La contraseña es obligatoria")]
        [MinLength(6, ErrorMessage = "Mínimo 6 caracteres")]
        public string Contrasena { get; set; } = string.Empty;

        [MaxLength(20)]
        public string? Telefono { get; set; }
    }
}
