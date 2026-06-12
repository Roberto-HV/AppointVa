using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Citas
{
    public class ActualizarNotasCitaDto
    {
        [MaxLength(1000)]
        public string? Notas { get; set; }
    }
}
