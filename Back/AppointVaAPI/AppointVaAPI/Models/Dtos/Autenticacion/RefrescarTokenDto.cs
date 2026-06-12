using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Autenticacion
{
    public class RefrescarTokenDto
    {
        [Required(ErrorMessage = "El refresh token es obligatorio")]
        public string RefreshToken { get; set; } = string.Empty;
    }
}
