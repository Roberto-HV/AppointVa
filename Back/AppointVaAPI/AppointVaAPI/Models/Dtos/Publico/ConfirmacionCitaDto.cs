namespace AppointVaAPI.Models.Dtos.Publico
{
    public class ConfirmacionCitaDto
    {
        public Guid Id { get; set; }
        public string CodigoConfirmacion { get; set; } = string.Empty;
        public string NombreNegocio { get; set; } = string.Empty;
        public string NegocioSlug { get; set; } = string.Empty;
        public Guid ServicioId { get; set; }
        public Guid EmpleadoId { get; set; }
        public string NombreServicio { get; set; } = string.Empty;
        public string NombreEmpleado { get; set; } = string.Empty;
        public string NombreCliente { get; set; } = string.Empty;
        public string? EmailCliente { get; set; }
        public DateTime InicioEn { get; set; }
        public DateTime FinEn { get; set; }
        public decimal Precio { get; set; }
        public byte Estado { get; set; }
        public string EstadoTexto { get; set; } = string.Empty;
        public string? Notas { get; set; }
        public string? GoogleCalUrl { get; set; }
        public int HorasCancelacion { get; set; }
        // B2: minimum notice in days, so the reschedule picker hides days the business does not accept.
        public int DiasAnticipacionMinima { get; set; }
        // B4: business sector ("belleza" | "salud") for the receipt wording after a direct visit.
        public string Sector { get; set; } = "belleza";
        public bool RequiereAnticipo { get; set; }
        public decimal? MontoAnticipo { get; set; }
        public string? InstruccionesAnticipo { get; set; }
        public int PorcentajeAnticipo { get; set; }
        public string PoliticaCancelacionAnticipo { get; set; } = string.Empty;
        public string? ComprobanteUrl { get; set; }
        public string? InstagramUrl { get; set; }
        public string? FacebookUrl { get; set; }
        public string? TiktokUrl { get; set; }
        public string ColorPrimario { get; set; } = "#334155";
    }
}
