namespace AppointVaAPI.Models.Dtos.Reportes
{
    public class ReporteCitasDto
    {
        /// <summary>Every appointment in the range, cancelled and no-show included (one per row of <see cref="Citas"/>).</summary>
        public int TotalCitas { get; set; }
        /// <summary>
        /// Appointments that count (pending, confirmed, completed): TotalCitas minus cancelled
        /// and no-shows. Same definition as Inicio's "Hoy / Semana / Mes" and Pagos (G3).
        /// </summary>
        public int TotalVigentes { get; set; }
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
