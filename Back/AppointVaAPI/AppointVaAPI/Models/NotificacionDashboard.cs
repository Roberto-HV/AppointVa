using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models
{
    public class NotificacionDashboard
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid NegocioId { get; set; }
        public Negocio Negocio { get; set; } = null!;

        [MaxLength(20)]
        public string Tipo { get; set; } = string.Empty;

        [MaxLength(200)]
        public string Titulo { get; set; } = string.Empty;

        [MaxLength(500)]
        public string Descripcion { get; set; } = string.Empty;

        public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

        public bool Leida { get; set; } = false;

        public Guid? CitaId { get; set; }
    }
}
