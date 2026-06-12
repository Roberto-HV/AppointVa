using Microsoft.AspNetCore.Identity;

namespace AppointVaAPI.Models
{
    public class ApplicationUser : IdentityUser<Guid>
    {
        public string? Nombre { get; set; }
        public string? Apellido { get; set; }
        // Nulo para SuperAdmin; poblado para Propietario y Empleado
        public Guid? NegocioId { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime FechaActualizacion { get; set; }
        public bool Activo { get; set; }
    }
}
