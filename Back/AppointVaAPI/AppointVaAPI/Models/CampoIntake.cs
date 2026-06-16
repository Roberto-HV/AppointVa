using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    public class CampoIntake
    {
        [Key]
        public Guid Id { get; set; }

        [Required]
        public Guid NegocioId { get; set; }
        [ForeignKey("NegocioId")]
        public Negocio? Negocio { get; set; }

        // null = aplica a todos los servicios
        public Guid? ServicioId { get; set; }
        [ForeignKey("ServicioId")]
        public Servicio? Servicio { get; set; }

        [Required, MaxLength(200)]
        public string Etiqueta { get; set; } = string.Empty;

        // Texto | MultilineTexto | Seleccion | Checkbox
        [Required, MaxLength(20)]
        public string Tipo { get; set; } = "Texto";

        // JSON array de strings para tipo Seleccion, ej: ["Sí","No","Tal vez"]
        public string? Opciones { get; set; }

        [Required]
        public bool Requerido { get; set; }

        [Required]
        public int Orden { get; set; }

        [Required]
        public bool Activo { get; set; } = true;
    }
}
