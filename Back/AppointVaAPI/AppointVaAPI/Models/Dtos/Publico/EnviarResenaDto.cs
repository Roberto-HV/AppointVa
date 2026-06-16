using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Publico
{
    public class EnviarResenaDto
    {
        [Required]
        [Range(1, 5)]
        public int Rating { get; set; }

        [MaxLength(1000)]
        public string? Comentario { get; set; }
    }
}
