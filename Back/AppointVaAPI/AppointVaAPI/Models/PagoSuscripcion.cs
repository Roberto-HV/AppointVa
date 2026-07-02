using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    public class PagoSuscripcion
    {
        [Key]
        public Guid Id { get; set; }

        [Required]
        public Guid NegocioId { get; set; }
        public Negocio Negocio { get; set; } = null!;

        [Required]
        public Guid RegistradoPorId { get; set; }
        public ApplicationUser RegistradoPor { get; set; } = null!;

        [Required]
        public DateTime FechaPago { get; set; }

        [Required]
        public DateTime PeriodoDesde { get; set; }

        [Required]
        public DateTime PeriodoHasta { get; set; }

        [Required]
        public int MesesPagados { get; set; }

        [Required]
        [Column(TypeName = "decimal(10,2)")]
        public decimal Monto { get; set; }

        [MaxLength(500)]
        public string? Notas { get; set; }

        [Required]
        public int NumeroPago { get; set; }
    }
}
