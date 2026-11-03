using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Negocios
{
    /// <summary>
    /// Owner account created by the SuperAdmin. Lote 5 (I4): there is no password here; the owner
    /// receives an invitation link and chooses it, so the admin never knows it.
    /// </summary>
    public class CrearPropietarioDto
    {
        [Required]
        [EmailAddress]
        [MaxLength(150)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MaxLength(80)]
        public string Nombre { get; set; } = string.Empty;

        [MaxLength(80)]
        public string Apellido { get; set; } = string.Empty;
    }
}
