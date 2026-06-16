using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    public class Descuento
    {
        [Key]
        public Guid Id { get; set; }

        [Required]
        public Guid NegocioId { get; set; }
        [ForeignKey("NegocioId")]
        public Negocio? Negocio { get; set; }

        [Required, MaxLength(50)]
        public string Codigo { get; set; } = string.Empty;

        [MaxLength(200)]
        public string? Descripcion { get; set; }

        // Porcentaje | MontoFijo
        [Required, MaxLength(20)]
        public string Tipo { get; set; } = "Porcentaje";

        [Required]
        [Column(TypeName = "decimal(10,2)")]
        public decimal Valor { get; set; }

        // null = ilimitado
        public int? UsoMaximo { get; set; }

        public int UsoActual { get; set; } = 0;

        public DateTime? FechaExpiracion { get; set; }

        [Required]
        public bool Activo { get; set; } = true;

        [Required]
        public DateTime FechaCreacion { get; set; }
    }
}
