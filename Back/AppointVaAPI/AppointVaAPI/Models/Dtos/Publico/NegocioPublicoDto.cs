namespace AppointVaAPI.Models.Dtos.Publico
{
    public class NegocioPublicoDto
    {
        public Guid Id { get; set; }
        public string Slug { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public string? LogoUrl { get; set; }
        public string? PortadaUrl { get; set; }
        public string? ColorPrimario { get; set; }
        public string? ColorSecundario { get; set; }
        public string? Telefono { get; set; }
        public string? TelefonoWhatsApp { get; set; }
        public int HorasCancelacion { get; set; }
        public bool AutoConfirmar { get; set; }
        public bool RequiereAnticipo { get; set; }
        public decimal MontoAnticipo { get; set; }
        public string? InstruccionesAnticipo { get; set; }
        public string? InstagramUrl { get; set; }
        public string? FacebookUrl { get; set; }
        public string? TiktokUrl { get; set; }
        public List<ServicioPublicoDto> Servicios { get; set; } = new();
        public List<EmpleadoPublicoDto> Empleados { get; set; } = new();
        public List<ImagenGaleriaDto> Galeria { get; set; } = new();
        public double PromedioResenas { get; set; }
        public int TotalResenas { get; set; }
        public List<ResenaPublicaDto> Resenas { get; set; } = new();
    }

    public class ServicioPublicoDto
    {
        public Guid Id { get; set; }
        public Guid? CategoriaId { get; set; }
        public string? CategoriaNombre { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public int DuracionMinutos { get; set; }
        public int BufferMinutos { get; set; }
        public decimal Precio { get; set; }
        public string? ImagenUrl { get; set; }
        public int Orden { get; set; }
    }

    public class EmpleadoPublicoDto
    {
        public Guid Id { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string? FotoUrl { get; set; }
        public string? Biografia { get; set; }
        public List<Guid> ServicioIds { get; set; } = new();
        public double PromedioResenas { get; set; }
        public int TotalResenas { get; set; }
    }

    public class ImagenGaleriaDto
    {
        public Guid Id { get; set; }
        public string Url { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public int Orden { get; set; }
    }

    public class ResenaPublicaDto
    {
        public int Rating { get; set; }
        public string? Comentario { get; set; }
        public string NombreCliente { get; set; } = string.Empty;
        public DateTime FechaCreacion { get; set; }
    }
}
