using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models
{
    public class AuditLog
    {
        public Guid Id { get; set; }
        public Guid? UsuarioId { get; set; }
        [MaxLength(100)]
        public string Accion { get; set; } = string.Empty;
        [MaxLength(50)]
        public string? Entidad { get; set; }
        [MaxLength(100)]
        public string? EntidadId { get; set; }
        [MaxLength(500)]
        public string? Detalles { get; set; }
        [MaxLength(50)]
        public string? IpAddress { get; set; }
        public DateTime FechaEn { get; set; }

        public ApplicationUser? Usuario { get; set; }
    }
}
