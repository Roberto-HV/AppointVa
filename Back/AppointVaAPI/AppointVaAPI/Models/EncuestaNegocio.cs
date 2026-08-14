namespace AppointVaAPI.Models
{
    public class EncuestaNegocio
    {
        public Guid Id { get; set; }
        public Guid NegocioId { get; set; }
        public Negocio Negocio { get; set; } = null!;

        public byte? Rating { get; set; }       // 1-5 stars; null until answered
        public string? Comentario { get; set; }

        // Pendiente | Pospuesta | Respondida | Rechazada
        public string Estado { get; set; } = "Pendiente";

        public DateTime? FechaProximoRecordatorio { get; set; }  // set when Estado=Pospuesta
        public bool Destacada { get; set; }                       // admin marks for landing page

        public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
        public DateTime? FechaRespuesta { get; set; }
    }
}
