namespace AppointVaAPI.Models.Dtos.Negocios
{
    public class NegocioDto
    {
        public Guid Id { get; set; }
        public string Slug { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public string? Telefono { get; set; }
        public string? Email { get; set; }
        public string? Direccion { get; set; }
        public string? Descripcion { get; set; }
        public string? LogoUrl { get; set; }
        public string? PortadaUrl { get; set; }
        public string? ColorPrimario { get; set; }
        public string? ColorSecundario { get; set; }
        public string ZonaHoraria { get; set; } = string.Empty;
        public string Moneda { get; set; } = string.Empty;
        public int HorasRecordatorio { get; set; }
        public int HorasCancelacion { get; set; }
        public bool AutoConfirmar { get; set; }
        public string MetodoNotificacion { get; set; } = "Correo";
        public string? TelefonoWhatsApp { get; set; }
        public bool RequiereAnticipo { get; set; }
        public decimal MontoAnticipo { get; set; }
        public string? InstruccionesAnticipo { get; set; }
        public string? InstagramUrl { get; set; }
        public string? FacebookUrl { get; set; }
        public string? TiktokUrl { get; set; }
        public bool Activo { get; set; }
        public string? PlanNombre { get; set; }
    }
}
