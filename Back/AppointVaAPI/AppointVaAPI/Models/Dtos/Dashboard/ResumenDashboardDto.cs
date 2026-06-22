namespace AppointVaAPI.Models.Dtos.Dashboard
{
    public class ResumenDashboardDto
    {
        public int CitasHoy { get; set; }
        public int CitasSemana { get; set; }
        public int CitasMes { get; set; }
        public decimal IngresosHoy { get; set; }
        public decimal IngresosSemana { get; set; }
        public decimal IngresosMes { get; set; }
        public List<CitaResumenDto> ProximasCitas { get; set; } = new();
        public List<ServicioPopularDto> TopServicios { get; set; } = new();
    }

    public class CitaResumenDto
    {
        public Guid Id { get; set; }
        public string CodigoConfirmacion { get; set; } = string.Empty;
        public string NombreCliente { get; set; } = string.Empty;
        public string NombreServicio { get; set; } = string.Empty;
        public string NombreEmpleado { get; set; } = string.Empty;
        public DateTime InicioEn { get; set; }
        public byte Estado { get; set; }
        public string EstadoTexto { get; set; } = string.Empty;
    }

    public class ServicioPopularDto
    {
        public string Nombre { get; set; } = string.Empty;
        public int TotalCitas { get; set; }
    }
}
