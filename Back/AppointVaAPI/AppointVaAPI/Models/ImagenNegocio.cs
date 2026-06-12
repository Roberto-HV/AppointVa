using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    public class ImagenNegocio
    {
        [Key]
        public Guid Id { get; set; }
        [Required]
        public Guid NegocioId { get; set; }
        [ForeignKey("NegocioId")]
        public Negocio? Negocio { get; set; }
        [Required]
        public string Url { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        [Required]
        public int Orden { get; set; }
        [Required]
        public DateTime FechaCreacion { get; set; }
    }
}
