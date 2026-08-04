using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models;

public class CierreCaja
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    public Guid NegocioId { get; set; }

    [ForeignKey("NegocioId")]
    public Negocio? Negocio { get; set; }

    [Required]
    public DateTime Fecha { get; set; }

    public decimal EfectivoInicial { get; set; }

    public decimal EfectivoContado { get; set; }

    public string RetirosJson { get; set; } = "[]";

    public DateTime? CerradoEn { get; set; }

    public Guid? CerradoPorId { get; set; }

    [ForeignKey("CerradoPorId")]
    public ApplicationUser? CerradoPor { get; set; }

    public DateTime FechaCreacion { get; set; }

    public DateTime FechaActualizacion { get; set; }
}
