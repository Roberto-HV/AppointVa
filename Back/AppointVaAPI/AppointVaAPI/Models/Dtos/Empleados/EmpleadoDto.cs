namespace AppointVaAPI.Models.Dtos.Empleados
{
    public class EmpleadoDto
    {
        public Guid Id { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string? Telefono { get; set; }
        public string? Email { get; set; }
        public string? FotoUrl { get; set; }
        public string? Biografia { get; set; }
        public bool Activo { get; set; }
        public List<Guid> ServicioIds { get; set; } = [];
    }
}
