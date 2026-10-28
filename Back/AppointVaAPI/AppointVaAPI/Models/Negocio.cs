using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    public class Negocio
    {
        [Key]
        public Guid Id { get; set; }
        [Required]
        public string Slug { get; set; } = string.Empty;
        [Required]
        public string Nombre { get; set; } = string.Empty;
        public string? Telefono { get; set; }
        public string? Email { get; set; }
        public string? Direccion { get; set; }
        public string? Descripcion { get; set; }
        public string? LogoUrl { get; set; }
        public string? PortadaUrl { get; set; }
        [MaxLength(20)]
        public string? PortadaObjectPosition { get; set; }
        // Clave del fondo generado por código (ej. "deg-aurora"); el CSS vive en el front.
        [MaxLength(40)]
        public string? PortadaPreset { get; set; }
        public string? PoliticasUrl { get; set; }
        public string? ColorPrimario { get; set; }
        public string? ColorSecundario { get; set; }
        [Required]
        public string ZonaHoraria { get; set; } = "Central Standard Time (Mexico)";
        [Required]
        public string Moneda { get; set; } = "MXN";
        public int HorasRecordatorio { get; set; } = 24;
        public int HorasCancelacion { get; set; } = 0;
        public int DiasAnticipacionMinima { get; set; } = 0;
        public bool AutoConfirmar { get; set; } = false;
        public bool ListaEsperaActiva { get; set; } = false;
        public bool ModuloPagosHabilitado { get; set; } = false;
        public bool EsTester { get; set; } = false;
        public int EmpleadosExtra { get; set; } = 0;
        // Notificaciones: "Correo" | "WhatsApp" | "Ambos"
        public string MetodoNotificacion { get; set; } = "Correo";
        public string? TelefonoWhatsApp { get; set; }
        // Anticipo
        public bool RequiereAnticipo { get; set; } = false;
        [Column(TypeName = "decimal(10,2)")]
        public decimal MontoAnticipo { get; set; } = 0;
        [MaxLength(500)]
        public string? InstruccionesAnticipo { get; set; }
        // 10 es el piso del porcentaje en el panel (deslizador 10–80). Nacer en 0
        // dejaba la columna fuera de su propio rango y el formulario de perfil
        // rechazaba en silencio cualquier negocio sin anticipos.
        public int PorcentajeAnticipo { get; set; } = 10;
        public int HorasCancelacionConReembolso { get; set; } = 24;
        [MaxLength(500)]
        public string PoliticaCancelacionAnticipo { get; set; } = string.Empty;
        [MaxLength(200)]
        public string? InstagramUrl { get; set; }
        [MaxLength(200)]
        public string? FacebookUrl { get; set; }
        [MaxLength(200)]
        public string? TiktokUrl { get; set; }
        [MaxLength(20)]
        [DefaultValue("belleza")]
        public string Sector { get; set; } = "belleza";
        public Guid? PlanId { get; set; }
        [ForeignKey("PlanId")]
        public Plan? Plan { get; set; }
        // B20: plan key chosen on the landing at sign-up ("basico" | "pro" | "premium").
        // Intent only: PlanId stays the one the SuperAdmin assigns.
        [MaxLength(20)]
        public string? PlanSolicitado { get; set; }
        [Required]
        public int Activo { get; set; }
        [Required]
        public DateTime FechaCreacion { get; set; }
        [Required]
        public DateTime FechaActualizacion { get; set; }
        public DateTime? FechaEliminacion { get; set; }
        public DateTime? FechaVencimiento { get; set; }
    }
}
