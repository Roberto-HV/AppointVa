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

        /// <summary>
        /// Current name of the affected business when Entidad is "Negocio"; null when the
        /// business no longer exists (a hard delete keeps its name in <see cref="Detalles"/>).
        /// </summary>
        public string? NegocioNombre { get; set; }
    }
}
