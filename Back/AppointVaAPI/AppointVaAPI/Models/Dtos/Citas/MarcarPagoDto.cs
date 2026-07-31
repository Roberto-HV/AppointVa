using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Citas;

public class MarcarPagoDto
{
    public bool Pagada { get; set; }

    [MaxLength(30)]
    public string? MetodoPago { get; set; }

    public decimal? MontoCobrado  { get; set; }
    public decimal? MontoRecibido { get; set; }
    public decimal? Cambio        { get; set; }
}
