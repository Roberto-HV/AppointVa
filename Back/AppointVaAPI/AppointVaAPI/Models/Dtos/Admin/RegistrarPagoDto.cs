using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Admin
{
    public class RegistrarPagoDto
    {
        [Required]
        [Range(1, 24)]
        public int MesesPagados { get; set; }

        [Required]
        [Range(0, 99999)]
        public decimal Monto { get; set; }

        [MaxLength(500)]
        public string? Notas { get; set; }
    }
}
