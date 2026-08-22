namespace AppointVaAPI.Models.Dtos.Horarios
{
    public class HorarioDiaDto
    {
        public byte DiaSemana { get; set; } // 0=Dom … 6=Sáb
        public bool Activo    { get; set; }
        public List<HorarioIntervaloDto> Intervalos { get; set; } = new();
    }
}
