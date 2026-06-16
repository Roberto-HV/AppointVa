using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    public class Servicio
    {
        [Key]
        public Guid Id { get; set; }
        [Required]
        public Guid NegocioId { get; set; }
        [ForeignKey("NegocioId")]
        public Negocio? Negocio { get; set; }
        public Guid? CategoriaId { get; set; }
        [ForeignKey("CategoriaId")]
        public CategoriaServicio? Categoria { get; set; }
        [Required]
        public string Nombre { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        [Required]
        public int DuracionMinutos { get; set; }
        [Required]
        public int BufferMinutos { get; set; }
        [Required]
        public decimal Precio { get; set; }
        public string? ImagenUrl { get; set; }
        [Required]
        public int Orden { get; set; }
        [Required]
        public int Activo { get; set; }
        [Required]
        public DateTime FechaCreacion { get; set; }
        [Required]
        public DateTime FechaActualizacion { get; set; }
        public DateTime? FechaEliminacion { get; set; }
    }
}
