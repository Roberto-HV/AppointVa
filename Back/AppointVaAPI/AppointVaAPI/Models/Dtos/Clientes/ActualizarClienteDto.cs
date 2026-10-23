using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Clientes
{
    /// <summary>Datos editables de un cliente desde el directorio (PUT api/clientes/{id}).</summary>
    public class ActualizarClienteDto
    {
        [Required]
        [StringLength(100)]
        public string NombreCompleto { get; set; } = string.Empty;

        /// <summary>Vacío o null deja al cliente sin teléfono.</summary>
        [StringLength(20)]
        public string? Telefono { get; set; }

        /// <summary>Vacío o null deja al cliente sin correo. El formato se valida en el controlador.</summary>
        [StringLength(256)]
        public string? Email { get; set; }
    }
}
