using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    public class RefreshToken
    {
        [Key]
        public Guid Id { get; set; }

        [Required]
        public string Token { get; set; } = string.Empty;

        [Required]
        public Guid UsuarioId { get; set; }

        [ForeignKey("UsuarioId")]
        public ApplicationUser? Usuario { get; set; }

        [Required]
        public DateTime FechaExpiracion { get; set; }

        [Required]
        public DateTime FechaCreacion { get; set; }

        public bool Usado { get; set; }

        public bool Revocado { get; set; }
    }
}
