namespace AppointVaAPI.Models.Dtos.Admin
{
    public class AuditLogDto
    {
        public Guid Id { get; set; }
        public Guid? UsuarioId { get; set; }
        public string? UsuarioEmail { get; set; }
        public string Accion { get; set; } = string.Empty;
        public string? Entidad { get; set; }
        public string? EntidadId { get; set; }
        public string? Detalles { get; set; }
        public string? IpAddress { get; set; }
        public DateTime FechaEn { get; set; }
    }
}
