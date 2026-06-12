using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Citas
{
    public class CambiarEstadoCitaDto
    {
        [Required]
        [Range(1, 5)]
        public byte NuevoEstado { get; set; }

        [StringLength(500)]
        public string? Motivo { get; set; }
    }
}
