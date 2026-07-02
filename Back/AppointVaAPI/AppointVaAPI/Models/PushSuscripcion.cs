using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models
{
    public class PushSuscripcion
    {
        public Guid Id { get; set; }
        public Guid UsuarioId { get; set; }

        [MaxLength(2048)]
        public string Endpoint { get; set; } = string.Empty;

        [MaxLength(512)]
        public string P256dh { get; set; } = string.Empty;

        [MaxLength(256)]
        public string Auth { get; set; } = string.Empty;

        public DateTime CreadaEn { get; set; } = DateTime.UtcNow;
        public DateTime ActualizadaEn { get; set; } = DateTime.UtcNow;

        public ApplicationUser? Usuario { get; set; }
    }
}
