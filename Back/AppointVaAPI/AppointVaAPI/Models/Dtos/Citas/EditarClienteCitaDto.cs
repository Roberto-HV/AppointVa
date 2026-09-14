namespace AppointVaAPI.Models.Dtos.Citas
{
    public class EditarClienteCitaDto
    {
        public string NombreCompleto { get; set; } = string.Empty;
        public string? Telefono { get; set; }
        public string? Email { get; set; }
    }
}
