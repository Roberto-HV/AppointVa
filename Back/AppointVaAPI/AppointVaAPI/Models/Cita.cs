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
        [MaxLength(30)]
        public string? MetodoPago2 { get; set; }
        public decimal? MontoPago2 { get; set; }
        public decimal? MontoCobrado  { get; set; }   // precio final cobrado
        public decimal? MontoRecibido { get; set; }   // dinero entregado por el cliente
        public decimal? Cambio        { get; set; }   // vuelto entregado
        public decimal? Propina       { get; set; }
        public DateTime? FechaPago    { get; set; }   // cuándo se registró el pago
        public bool AnticipoRequerido { get; set; } = false;
        [Column(TypeName = "decimal(10,2)")]
        public decimal? MontoAnticipo { get; set; }
        public bool AnticipoRecibido { get; set; } = false;
        public Guid? AnticipoRecibidoPorId { get; set; }
        [MaxLength(100)]
        public string? AnticipoRecibidoPorNombre { get; set; }
        public DateTime? AnticipoRecibidoEn { get; set; }
        public Guid?     RegistradoPorId { get; set; } // FK a ApplicationUser
        public Guid? CreadoPorUsuarioId { get; set; }
        public string? ComprobanteUrl { get; set; }
        [Required]
        public DateTime FechaCreacion { get; set; }
        [Required]
        public DateTime FechaActualizacion { get; set; }
    }
}
