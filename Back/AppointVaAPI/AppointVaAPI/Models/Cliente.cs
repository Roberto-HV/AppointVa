using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    public class Cliente
    {
        [Key]
        public Guid Id { get; set; }
        [Required]
        public Guid NegocioId { get; set; }
        [ForeignKey("NegocioId")]
        public Negocio? Negocio { get; set; }
        [Required]
        public string NombreCompleto { get; set; } = string.Empty;
        [Required]
        public string Telefono { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? Notas { get; set; }
        [Required]
        public int TotalCitas { get; set; }
        [Required]
        public int CantidadInasistencias { get; set; }
        public DateTime? UltimaCitaEn { get; set; }
        [Required]
        public DateTime FechaCreacion { get; set; }
        [Required]
        public DateTime FechaActualizacion { get; set; }
    }
}
