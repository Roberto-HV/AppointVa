namespace AppointVaAPI.Models
{
    public class CampoIntakeServicio
    {
        public Guid CampoIntakeId { get; set; }
        public CampoIntake CampoIntake { get; set; } = null!;
        public Guid ServicioId { get; set; }
        public Servicio Servicio { get; set; } = null!;
    }
}
