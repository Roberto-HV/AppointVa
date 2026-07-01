namespace AppointVaAPI.Models.Dtos.Negocios
{
    public class NegocioMetricasDto
    {
        public Guid Id { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public int Activo { get; set; }
        public string? LogoUrl { get; set; }
        public string? Email { get; set; }
        public string? ColorPrimario { get; set; }
        public string? ColorSecundario { get; set; }
        public string? PlanNombre { get; set; }
        public Guid? PlanId { get; set; }
        public int MaxCitasMes { get; set; }
        public int MaxEmpleados { get; set; }
        public int CitasMes { get; set; }
        public int EmpleadosActivos { get; set; }
        public int EmailsMes { get; set; }
    }
}
