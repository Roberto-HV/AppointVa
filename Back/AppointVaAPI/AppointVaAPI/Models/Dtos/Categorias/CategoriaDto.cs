namespace AppointVaAPI.Models.Dtos.Categorias
{
    public class CategoriaDto
    {
        public Guid Id { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public int Orden { get; set; }
        public bool Activo { get; set; }
    }
}
