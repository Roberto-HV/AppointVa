using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models
{
    public class Plan
    {
        [Key]
        public Guid Id { get; set; }
        [Required]
        public string Nombre { get; set; } = string.Empty;
        [Required]
        public decimal PrecioMensual { get; set; }
        [Required]
        public int MaxEmpleados { get; set; }
        [Required]
        public int MaxCitasMes { get; set; }
        public string? Caracteristicas { get; set; }
        [Required]
        public int Activo { get; set; }
        [Required]
        public DateTime FechaCreacion { get; set; }
    }
}
