using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Negocios
{
    // Usado por el super-admin para dar de alta un nuevo negocio
    public class CrearNegocioDto
    {
        [Required(ErrorMessage = "El nombre es obligatorio")]
        [MaxLength(150)]
        public string Nombre { get; set; } = string.Empty;

        [Required(ErrorMessage = "El slug es obligatorio")]
        [MaxLength(80)]
        [RegularExpression(@"^[a-z0-9\-]+$", ErrorMessage = "El slug solo puede contener minúsculas, números y guiones")]
        public string Slug { get; set; } = string.Empty;

        [MaxLength(20)]
        public string? Telefono { get; set; }

        [EmailAddress]
        [MaxLength(150)]
        public string? Email { get; set; }

        [MaxLength(500)]
        public string? Descripcion { get; set; }

        public Guid? PlanId { get; set; }

        /// <summary>
        /// Lote 5 (I8): optional owner, created in the same transaction and invited by email link.
        /// </summary>
        public CrearPropietarioDto? Propietario { get; set; }
    }

    /// <summary>Answer of POST api/negocios: the business plus what happened with the owner invitation.</summary>
    public class NegocioCreadoDto : NegocioDto
    {
        public string? PropietarioEmail { get; set; }

        /// <summary>Null without owner; false when the account was created but the email could not be sent.</summary>
        public bool? InvitacionEnviada { get; set; }
    }
}
