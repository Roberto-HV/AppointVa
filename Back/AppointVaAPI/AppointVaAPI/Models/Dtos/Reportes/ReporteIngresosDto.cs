namespace AppointVaAPI.Models.Dtos.Reportes
{
    public class ReporteIngresosDto
    {
        public decimal TotalIngresos { get; set; }
        public int TotalCitasCompletadas { get; set; }
        public decimal TicketPromedio { get; set; }
        public List<IngresosPorServicioDto> PorServicio { get; set; } = new();
        public List<IngresosPorEmpleadoDto> PorEmpleado { get; set; } = new();
        public List<IngresosPorDiaDto> PorDia { get; set; } = new();
    }

    public class IngresosPorServicioDto
    {
        public Guid ServicioId { get; set; }
        public string NombreServicio { get; set; } = string.Empty;
        public int TotalCitas { get; set; }
        public decimal TotalIngresos { get; set; }
        public decimal Porcentaje { get; set; }
    }

    public class IngresosPorEmpleadoDto
    {
        public Guid EmpleadoId { get; set; }
        public string NombreEmpleado { get; set; } = string.Empty;
        public int TotalCitas { get; set; }
        public decimal TotalIngresos { get; set; }
    }

    public class IngresosPorDiaDto
    {
        public string Fecha { get; set; } = string.Empty;
        public int TotalCitas { get; set; }
        public decimal TotalIngresos { get; set; }
    }
}
