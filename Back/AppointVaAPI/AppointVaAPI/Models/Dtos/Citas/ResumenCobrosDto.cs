namespace AppointVaAPI.Models.Dtos.Citas
{
    public class ResumenCobrosDto
    {
        public decimal TotalCobrado { get; set; }
        public decimal TotalPendiente { get; set; }
        public int CitasPagadas { get; set; }
        public int TotalCitas { get; set; }
        public List<DesgloseMetodoPagoDto> Desglose { get; set; } = new();
    }

    public class DesgloseMetodoPagoDto
    {
        public string Metodo { get; set; } = string.Empty;
        public int Cantidad { get; set; }
        public decimal Monto { get; set; }
    }
}
