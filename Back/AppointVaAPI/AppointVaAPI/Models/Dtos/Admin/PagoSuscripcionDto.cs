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

        // Billing fields
        public string? PlanNombre { get; set; }
        public decimal PrecioBase { get; set; }
        public int MaxEmpleadosBase { get; set; }
        public int EmpleadosExtra { get; set; }
        /// <summary>List price of the assigned plan plus extras, whether or not it is paid.</summary>
        public decimal TotalMensual { get; set; }
        /// <summary>Monthly price of each extra employee, so the front never hard-codes it.</summary>
        public decimal PrecioEmpleadoExtra { get; set; }
        public string Sector { get; set; } = "belleza";

        // Lote 2 (G3): see Helpers.FacturacionAdmin for the definitions.
        public bool EsTester { get; set; }
        /// <summary>A recorded payment covers today (Activa or PorVencer).</summary>
        public bool SuscripcionVigente { get; set; }
        /// <summary>One-off lifetime access: current, but with no monthly charge.</summary>
        public bool AccesoPermanente { get; set; }
        /// <summary>What this business adds to the monthly income; the rows, footer and KPIs sum this.</summary>
        public decimal IngresoMensual { get; set; }
    }

    public record SetEmpleadosExtraDto(int EmpleadosExtra);
    public record SetSectorDto(string Sector);
    public record SetPlanDto(Guid? PlanId);
    public record EditarPagoDto(decimal Monto, string? Notas, DateTime PeriodoDesde, DateTime PeriodoHasta);
}
