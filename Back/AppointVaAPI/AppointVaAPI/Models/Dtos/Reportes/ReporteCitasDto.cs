namespace AppointVaAPI.Models.Dtos.Reportes
{
    public class ReporteCitasDto
    {
        public int TotalCitas { get; set; }
        public int TotalCompletadas { get; set; }
        public int TotalCanceladas { get; set; }
        public int TotalPendientes { get; set; }
        public int TotalInasistencias { get; set; }
        public decimal TotalIngresos { get; set; }
        public decimal TotalIngresosEfectivo { get; set; }
        public decimal TotalIngresosTarjeta { get; set; }
        public List<FilaCitaReporteDto> Citas { get; set; } = new();
    }

    public class FilaCitaReporteDto
    {
        public Guid Id { get; set; }
        public string CodigoConfirmacion { get; set; } = string.Empty;
        public string NombreCliente { get; set; } = string.Empty;
        public string TelefonoCliente { get; set; } = string.Empty;
        public string? EmailCliente { get; set; }
        public string NombreServicio { get; set; } = string.Empty;
        public string NombreEmpleado { get; set; } = string.Empty;
        public DateTime InicioEn { get; set; }
        public int DuracionMinutos { get; set; }
        public decimal Precio { get; set; }
        public bool Pagada { get; set; }
        public string? MetodoPago { get; set; }
        public byte Estado { get; set; }
        public string EstadoTexto { get; set; } = string.Empty;
        public string? Notas { get; set; }
    }
}
