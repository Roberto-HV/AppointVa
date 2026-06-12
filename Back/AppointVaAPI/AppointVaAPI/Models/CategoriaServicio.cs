using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    public class CategoriaServicio
    {
        [Key]
        public Guid Id { get; set; }
        [Required]
        public Guid NegocioId { get; set; }
        [ForeignKey("NegocioId")]
        public Negocio? Negocio { get; set; }
        [Required]
        public string Nombre { get; set; } = string.Empty;
        [Required]
        public int Orden { get; set; }
        [Required]
        public int Activo { get; set; }
    }
}
