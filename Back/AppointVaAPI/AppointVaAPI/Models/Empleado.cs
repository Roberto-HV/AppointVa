using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    public class Empleado
    {
        [Key]
        public Guid Id { get; set; }
        [Required]
        public Guid NegocioId { get; set; }
        [ForeignKey("NegocioId")]
        public Negocio? Negocio { get; set; }
        public Guid? UsuarioId { get; set; }
        [Required]
        public string Nombre { get; set; } = string.Empty;
        public string? Telefono { get; set; }
        public string? Email { get; set; }
        public string? FotoUrl { get; set; }
        public string? Biografia { get; set; }
        [Required]
        public int Activo { get; set; }
        [Required]
        public DateTime FechaCreacion { get; set; }
        [Required]
        public DateTime FechaActualizacion { get; set; }
        public DateTime? FechaEliminacion { get; set; }
    }
}
