using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Publico
{
    public class UnirseListaEsperaDto
    {
        [Required]
        public string Slug { get; set; } = string.Empty;

        [Required, MaxLength(100)]
        public string NombreCliente { get; set; } = string.Empty;

        [Required, MaxLength(20)]
        public string TelefonoCliente { get; set; } = string.Empty;

        [MaxLength(200), EmailAddress]
        public string? EmailCliente { get; set; }

        public Guid? ServicioId { get; set; }
        public Guid? EmpleadoId { get; set; }
        public DateTime? FechaPreferida { get; set; }
    }
}
