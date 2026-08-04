using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Citas;

public class MarcarPagoDto
{
    public bool Pagada { get; set; }

    [MaxLength(30)]
    public string? MetodoPago { get; set; }

    [MaxLength(30)]
    public string? MetodoPago2 { get; set; }

    [Range(0, double.MaxValue)]
    public decimal? MontoPago2 { get; set; }

    [Range(0, double.MaxValue)]
    public decimal? MontoCobrado  { get; set; }

    [Range(0, double.MaxValue)]
    public decimal? MontoRecibido { get; set; }

    [Range(0, double.MaxValue)]
    public decimal? Cambio        { get; set; }

    [Range(0, double.MaxValue)]
    public decimal? Propina       { get; set; }
}
