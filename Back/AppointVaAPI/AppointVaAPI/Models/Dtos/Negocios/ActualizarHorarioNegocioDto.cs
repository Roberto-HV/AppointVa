namespace AppointVaAPI.Models.Dtos.Negocios
{
    public class ActualizarHorarioNegocioDto
    {
        public byte DiaSemana { get; set; }
        public string HoraInicio { get; set; } = "09:00";
        public string HoraFin { get; set; } = "18:00";
        public bool Activo { get; set; }
    }
}
