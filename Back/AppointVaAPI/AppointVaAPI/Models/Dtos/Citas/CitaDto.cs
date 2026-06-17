namespace AppointVaAPI.Models.Dtos.Citas
{
    public class CitaDto
    {
        public Guid Id { get; set; }
        public string CodigoConfirmacion { get; set; } = string.Empty;
        public Guid NegocioId { get; set; }

        // Cliente
        public Guid ClienteId { get; set; }
        public string NombreCliente { get; set; } = string.Empty;
        public string TelefonoCliente { get; set; } = string.Empty;
        public string? EmailCliente { get; set; }

        // Empleado
        public Guid EmpleadoId { get; set; }
        public string NombreEmpleado { get; set; } = string.Empty;

        // Servicio
        public Guid ServicioId { get; set; }
        public string NombreServicio { get; set; } = string.Empty;
        public int DuracionMinutos { get; set; }

        // Cita
        public decimal Precio { get; set; }
        public bool Pagada { get; set; }
        public string? MetodoPago { get; set; }
        public DateTime InicioEn { get; set; }
        public DateTime FinEn { get; set; }
        public byte Estado { get; set; }
        public string EstadoTexto { get; set; } = string.Empty;
        public string? Notas { get; set; }
        public string? MotivoCancelacion { get; set; }
        public string? ComprobanteUrl { get; set; }
        public DateTime FechaCreacion { get; set; }
    }
}
