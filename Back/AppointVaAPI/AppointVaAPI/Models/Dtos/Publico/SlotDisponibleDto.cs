namespace AppointVaAPI.Models.Dtos.Publico
{
    public class SlotDisponibleDto
    {
        public DateTime Inicio { get; set; }
        public DateTime Fin { get; set; }
        public string HoraTexto { get; set; } = string.Empty;
        public Guid? EmpleadoId { get; set; }
        public string? EmpleadoNombre { get; set; }
    }
}
