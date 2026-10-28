using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Negocios
{
    /// <summary>
    /// B11 (OM-04): saves only the cover focal point, as a CSS object-position "X% Y%".
    /// </summary>
    public class PortadaPosicionDto
    {
        [Required(ErrorMessage = "La posición de la portada es obligatoria")]
        [MaxLength(20)]
        [RegularExpression(@"^\d{1,3}(\.\d{1,2})?% \d{1,3}(\.\d{1,2})?%$",
            ErrorMessage = "Posición de portada inválida. Usa el formato \"50% 50%\".")]
        public string PortadaObjectPosition { get; set; } = string.Empty;
    }

    /// <summary>
    /// B12 (OM-15): the full gallery in its new order, first photo first.
    /// </summary>
    public class ReordenarGaleriaDto
    {
        [Required]
        public List<Guid> Ids { get; set; } = new();
    }
}
