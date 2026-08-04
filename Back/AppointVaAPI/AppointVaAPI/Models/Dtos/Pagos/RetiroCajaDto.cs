using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Pagos;

public class RetiroCajaDto
{
    [Required, MaxLength(100)]
    public string Concepto { get; set; } = string.Empty;

    [Range(0.01, double.MaxValue)]
    public decimal Monto { get; set; }
}
