namespace AppointVaAPI.Models.Dtos.Kiosco
{
    public class IniciarKioscoDto
    {
        /// <summary>The opener's refresh token: revoked so the device keeps nothing that restores the session.</summary>
        public string? RefreshToken { get; set; }
    }

    public class SesionKioscoDto
    {
        public string Token { get; set; } = string.Empty;
        public DateTime TokenExpiracion { get; set; }
        public Autenticacion.UsuarioInfoDto Usuario { get; set; } = new();
    }

    public class SalirKioscoDto
    {
        public string Contrasena { get; set; } = string.Empty;
    }

    /// <summary>Everything the reception screen shows, and nothing more (DC-28: name + initial only).</summary>
    public class AgendaKioscoDto
    {
        public string NombreNegocio { get; set; } = string.Empty;
        public string Sector { get; set; } = "belleza";
        /// <summary>False when an Empleado opened the screen: the day's revenue is not theirs to show.</summary>
        public bool MostrarIngresos { get; set; }
        public List<EmpleadoKioscoDto> Empleados { get; set; } = [];
        public List<CitaKioscoDto> Citas { get; set; } = [];
    }

    public class EmpleadoKioscoDto
    {
        public Guid Id { get; set; }
        public string Nombre { get; set; } = string.Empty;
    }

    public class CitaKioscoDto
    {
        public Guid Id { get; set; }
        public Guid EmpleadoId { get; set; }
        public string NombreCliente { get; set; } = string.Empty;
        public string NombreServicio { get; set; } = string.Empty;
        public int DuracionMinutos { get; set; }
        public decimal Precio { get; set; }
        public bool Pagada { get; set; }
        public DateTime InicioEn { get; set; }
        public DateTime FinEn { get; set; }
        public string EstadoTexto { get; set; } = string.Empty;
    }
}
