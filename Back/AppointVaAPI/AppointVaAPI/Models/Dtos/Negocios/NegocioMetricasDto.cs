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
        public bool ModuloPagosHabilitado { get; set; }
        public bool EsTester { get; set; }
        public string? PropietarioEmail { get; set; }
        public string? PropietarioNombre { get; set; }
        // B23 (AP-07): registration date (UTC) and whether the owner verified the email.
        // EmailConfirmado is null when the business has no owner account.
        public DateTime FechaCreacion { get; set; }
        public bool? EmailConfirmado { get; set; }
        // B20: plan chosen on the landing at sign-up, if any.
        public string? PlanSolicitado { get; set; }
    }
}
