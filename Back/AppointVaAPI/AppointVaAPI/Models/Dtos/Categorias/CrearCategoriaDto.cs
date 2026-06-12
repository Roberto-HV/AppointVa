using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Categorias
{
    public class CrearCategoriaDto
    {
        [Required(ErrorMessage = "El nombre es obligatorio")]
        [MaxLength(100)]
        public string Nombre { get; set; } = string.Empty;

        public int Orden { get; set; }
    }
}
