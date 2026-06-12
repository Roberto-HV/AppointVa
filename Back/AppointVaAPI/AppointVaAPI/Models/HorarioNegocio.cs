using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    public class HorarioNegocio
    {
        [Key]
        public Guid Id { get; set; }
        [Required]
        public Guid NegocioId { get; set; }
        [ForeignKey("NegocioId")]
        public Negocio? Negocio { get; set; }
        [Required]
        public byte DiaSemana { get; set; } // 0=Dom 1=Lun 2=Mar 3=Mié 4=Jue 5=Vie 6=Sáb
        [Required]
        public TimeSpan HoraInicio { get; set; }
        [Required]
        public TimeSpan HoraFin { get; set; }
        [Required]
        public int Activo { get; set; }
    }
}
