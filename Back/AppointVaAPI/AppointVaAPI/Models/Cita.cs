using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    public class Cita
    {
        [Key]
        public Guid Id { get; set; }
        [Required]
        public Guid NegocioId { get; set; }
        [ForeignKey("NegocioId")]
        public Negocio? Negocio { get; set; }
        [Required]
        public string CodigoConfirmacion { get; set; } = string.Empty;
        [Required]
        public Guid ClienteId { get; set; }
        [ForeignKey("ClienteId")]
        public Cliente? Cliente { get; set; }
        [Required]
        public Guid EmpleadoId { get; set; }
        [ForeignKey("EmpleadoId")]
        public Empleado? Empleado { get; set; }
        [Required]
        public Guid ServicioId { get; set; }
        [ForeignKey("ServicioId")]
        public Servicio? Servicio { get; set; }
        [Required]
        public DateTime InicioEn { get; set; }
        [Required]
        public DateTime FinEn { get; set; }
        [Required]
        public byte Estado { get; set; }
        [Required]
        public decimal Precio { get; set; }
        public string? Notas { get; set; }
        public string? MotivoCancelacion { get; set; }
        public bool Pagada { get; set; }
        [MaxLength(30)]
        public string? MetodoPago { get; set; }
        public Guid? CreadoPorUsuarioId { get; set; }
        public string? ComprobanteUrl { get; set; }
        [Required]
        public DateTime FechaCreacion { get; set; }
        [Required]
        public DateTime FechaActualizacion { get; set; }
    }
}
