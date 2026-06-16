using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Servicios
{
    public class ActualizarServicioDto
    {
        public Guid? CategoriaId { get; set; }

        [Required(ErrorMessage = "El nombre es obligatorio")]
        [MaxLength(150)]
        public string Nombre { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Descripcion { get; set; }

        [Required]
        [Range(5, 480, ErrorMessage = "La duración debe ser entre 5 y 480 minutos")]
        public int DuracionMinutos { get; set; }

        [Range(0, 120, ErrorMessage = "El buffer debe ser entre 0 y 120 minutos")]
        public int BufferMinutos { get; set; }

        [Required]
        [Range(0, 9999999)]
        public decimal Precio { get; set; }

        public int Orden { get; set; }

        public bool Activo { get; set; } = true;
    }
}
