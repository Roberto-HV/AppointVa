using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    public class EmpleadoServicio
    {
        [ForeignKey("Empleado")]
        public Guid EmpleadoId { get; set; }
        public Empleado? Empleado { get; set; }

        [ForeignKey("Servicio")]
        public Guid ServicioId { get; set; }
        public Servicio? Servicio { get; set; }
    }
}
