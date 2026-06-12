namespace AppointVaAPI.Models.Dtos.Servicios
{
    public class ServicioDto
    {
        public Guid Id { get; set; }
        public Guid NegocioId { get; set; }
        public Guid? CategoriaId { get; set; }
        public string? CategoriaNombre { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public int DuracionMinutos { get; set; }
        public decimal Precio { get; set; }
        public string? ImagenUrl { get; set; }
        public int Orden { get; set; }
        public bool Activo { get; set; }
    }
}
