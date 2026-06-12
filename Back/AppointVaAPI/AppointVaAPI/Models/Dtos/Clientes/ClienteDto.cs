namespace AppointVaAPI.Models.Dtos.Clientes
{
    public class ClienteDto
    {
        public Guid Id { get; set; }
        public string NombreCompleto { get; set; } = string.Empty;
        public string Telefono { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? Notas { get; set; }
        public int TotalCitas { get; set; }
        public int CantidadInasistencias { get; set; }
        public DateTime? UltimaCitaEn { get; set; }
        public DateTime FechaCreacion { get; set; }
    }
}
