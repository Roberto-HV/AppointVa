using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Negocios
{
    // Solo SuperAdmin puede actualizar los colores de un negocio
    public class ActualizarColoresNegocioDto
    {
        [MaxLength(7)]
        public string? ColorPrimario { get; set; }

        [MaxLength(7)]
        public string? ColorSecundario { get; set; }
    }
}
