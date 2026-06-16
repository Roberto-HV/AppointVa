using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    public class Negocio
    {
        [Key]
        public Guid Id { get; set; }
        [Required]
        public string Slug { get; set; } = string.Empty;
        [Required]
        public string Nombre { get; set; } = string.Empty;
        public string? Telefono { get; set; }
        public string? Email { get; set; }
        public string? Direccion { get; set; }
        public string? Descripcion { get; set; }
        public string? LogoUrl { get; set; }
        public string? PortadaUrl { get; set; }
        public string? ColorPrimario { get; set; }
        public string? ColorSecundario { get; set; }
        [Required]
        public string ZonaHoraria { get; set; } = "Central Standard Time (Mexico)";
        [Required]
        public string Moneda { get; set; } = "MXN";
        public int HorasRecordatorio { get; set; } = 24;
        public int HorasCancelacion { get; set; } = 0;
        public bool AutoConfirmar { get; set; } = false;
        public Guid? PlanId { get; set; }
        [ForeignKey("PlanId")]
        public Plan? Plan { get; set; }
        [Required]
        public int Activo { get; set; }
        [Required]
        public DateTime FechaCreacion { get; set; }
        [Required]
        public DateTime FechaActualizacion { get; set; }
        public DateTime? FechaEliminacion { get; set; }
    }
}
