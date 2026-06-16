using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    public class ListaEspera
    {
        [Key]
        public Guid Id { get; set; }

        [Required]
        public Guid NegocioId { get; set; }
        [ForeignKey("NegocioId")]
        public Negocio? Negocio { get; set; }

        public Guid? ServicioId { get; set; }
        [ForeignKey("ServicioId")]
        public Servicio? Servicio { get; set; }

        public Guid? EmpleadoId { get; set; }
        [ForeignKey("EmpleadoId")]
        public Empleado? Empleado { get; set; }

        [Required]
        public string NombreCliente { get; set; } = string.Empty;

        [Required]
        public string TelefonoCliente { get; set; } = string.Empty;

        public string? EmailCliente { get; set; }

        public DateTime? FechaPreferida { get; set; }

        [Required, MaxLength(20)]
        public string Estado { get; set; } = "Esperando"; // Esperando | Notificado | Confirmado | Expirado

        [Required]
        public DateTime FechaCreacion { get; set; }

        public DateTime? FechaNotificacion { get; set; }
    }
}
