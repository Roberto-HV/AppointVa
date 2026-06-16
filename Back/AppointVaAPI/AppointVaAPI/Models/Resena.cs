using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    public class Resena
    {
        [Key]
        public Guid Id { get; set; }
        [Required]
        public Guid NegocioId { get; set; }
        [ForeignKey("NegocioId")]
        public Negocio? Negocio { get; set; }
        public Guid? CitaId { get; set; }
        [ForeignKey("CitaId")]
        public Cita? Cita { get; set; }
        [Required]
        [Range(1, 5)]
        public int Rating { get; set; }
        [MaxLength(1000)]
        public string? Comentario { get; set; }
        [Required]
        [MaxLength(200)]
        public string NombreCliente { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string Token { get; set; } = string.Empty;
        [Required]
        public bool Respondida { get; set; }
        [Required]
        public bool Aprobada { get; set; } = true;
        [Required]
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaExpiracion { get; set; }
    }
}
