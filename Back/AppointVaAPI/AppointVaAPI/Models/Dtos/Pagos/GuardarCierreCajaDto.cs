using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Pagos;

public class GuardarCierreCajaDto
{
    [Required]
    public string Fecha { get; set; } = string.Empty;

    [Range(0, double.MaxValue)]
    public decimal EfectivoInicial { get; set; }

    [Range(0, double.MaxValue)]
    public decimal EfectivoContado { get; set; }

    public List<RetiroCajaDto> Retiros { get; set; } = new();
}
