using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models
{
    public class EmailLog
    {
        public Guid Id { get; set; }
        public Guid NegocioId { get; set; }
        [MaxLength(50)]
        public string Tipo { get; set; } = string.Empty;
        public DateTime EnviadoEn { get; set; }
        public Negocio? Negocio { get; set; }
    }
}
