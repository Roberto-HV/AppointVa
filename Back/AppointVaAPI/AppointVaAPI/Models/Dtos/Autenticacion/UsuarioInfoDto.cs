namespace AppointVaAPI.Models.Dtos.Autenticacion
{
    public class UsuarioInfoDto
    {
        public Guid Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public string NombreCompleto { get; set; } = string.Empty;
        public string Rol { get; set; } = string.Empty;
        public Guid? NegocioId { get; set; }
    }
}
