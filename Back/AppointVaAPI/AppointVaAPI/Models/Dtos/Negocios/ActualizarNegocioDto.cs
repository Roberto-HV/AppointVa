using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Negocios
{
    // Usado por el propietario para actualizar su propio negocio
    public class ActualizarNegocioDto
    {
        [Required(ErrorMessage = "El nombre es obligatorio")]
        [MaxLength(150)]
        public string Nombre { get; set; } = string.Empty;

        [MaxLength(20)]
        public string? Telefono { get; set; }

        [EmailAddress]
        [MaxLength(150)]
        public string? Email { get; set; }

        [MaxLength(200)]
        public string? Direccion { get; set; }

        [MaxLength(500)]
        public string? Descripcion { get; set; }

        [MaxLength(100)]
        public string? ZonaHoraria { get; set; }

        public int? HorasRecordatorio { get; set; }

        [Range(0, 168, ErrorMessage = "HorasCancelacion debe estar entre 0 y 168")]
        public int? HorasCancelacion { get; set; }

        public bool? AutoConfirmar { get; set; }
    }
}
