using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Publico
{
    public class CrearCitaPublicaDto
    {
        [Required]
        public string NegocioSlug { get; set; } = string.Empty;

        [Required]
        public Guid ServicioId { get; set; }

        [Required]
        public Guid EmpleadoId { get; set; }

        [Required]
        public DateTime InicioEn { get; set; }

        [Required]
        [StringLength(100)]
        public string NombreCliente { get; set; } = string.Empty;

        [Required]
        [StringLength(20)]
        public string TelefonoCliente { get; set; } = string.Empty;

        [EmailAddress]
        public string? EmailCliente { get; set; }

        [StringLength(500)]
        public string? Notas { get; set; }

        [MaxLength(50)]
        public string? CodigoDescuento { get; set; }
    }
}
