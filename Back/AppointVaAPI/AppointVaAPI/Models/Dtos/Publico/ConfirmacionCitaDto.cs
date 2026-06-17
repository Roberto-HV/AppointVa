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
        public DateTime InicioEn { get; set; }
        public DateTime FinEn { get; set; }
        public decimal Precio { get; set; }
        public byte Estado { get; set; }
        public string EstadoTexto { get; set; } = string.Empty;
        public string? Notas { get; set; }
        public string? IcalUrl { get; set; }
        public string? WebcalUrl { get; set; }
        public string? GoogleCalUrl { get; set; }
        public int HorasCancelacion { get; set; }
        public bool RequiereAnticipo { get; set; }
        public decimal MontoAnticipo { get; set; }
        public string? InstruccionesAnticipo { get; set; }
        public string? ComprobanteUrl { get; set; }
    }
}
