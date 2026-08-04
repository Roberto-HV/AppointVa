namespace AppointVaAPI.Models.Dtos.Pagos;

public class CierreCajaDto
{
    public Guid Id { get; set; }
    public string Fecha { get; set; } = string.Empty;
    public decimal EfectivoInicial { get; set; }
    public decimal EfectivoContado { get; set; }
    public decimal EfectivoCobrado { get; set; }
    public decimal TotalRetiros { get; set; }
    public decimal EfectivoEsperado { get; set; }
    public decimal Diferencia { get; set; }
    public List<RetiroCajaDto> Retiros { get; set; } = new();
    public DateTime? CerradoEn { get; set; }
}
