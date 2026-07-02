namespace AppointVaAPI.Models.Dtos.Admin
{
    public class PagoSuscripcionDto
    {
        public Guid Id { get; set; }
        public Guid NegocioId { get; set; }
        public string NegocioNombre { get; set; } = string.Empty;
        public string RegistradoPorEmail { get; set; } = string.Empty;
        public DateTime FechaPago { get; set; }
        public DateTime PeriodoDesde { get; set; }
        public DateTime PeriodoHasta { get; set; }
        public int MesesPagados { get; set; }
        public decimal Monto { get; set; }
        public string? Notas { get; set; }
        public int NumeroPago { get; set; }
    }

    public class SuscripcionResumenDto
    {
        public Guid NegocioId { get; set; }
        public string NegocioNombre { get; set; } = string.Empty;
        public string NegocioSlug { get; set; } = string.Empty;
        public DateTime? FechaVencimiento { get; set; }
        public string Estado { get; set; } = string.Empty; // Activa | PorVencer | Vencida | SinSuscripcion
        public int? DiasRestantes { get; set; }
        public int TotalPagos { get; set; }
        public PagoSuscripcionDto? UltimoPago { get; set; }
    }
}
