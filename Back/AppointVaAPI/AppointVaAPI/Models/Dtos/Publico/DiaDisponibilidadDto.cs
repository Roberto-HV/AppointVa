namespace AppointVaAPI.Models.Dtos.Publico
{
    /// <summary>Availability of one day inside a range (GET api/publico/disponibilidad/semana).</summary>
    public class DiaDisponibilidadDto
    {
        /// <summary>yyyy-MM-dd, in the business's local calendar.</summary>
        public string Fecha { get; set; } = string.Empty;

        /// <summary>One of <see cref="EstadosDiaDisponibilidad"/>.</summary>
        public string Estado { get; set; } = EstadosDiaDisponibilidad.SinHorarios;

        public List<SlotDisponibleDto> Horarios { get; set; } = new();
    }

    public static class EstadosDiaDisponibilidad
    {
        /// <summary>There is at least one free slot.</summary>
        public const string ConHorarios = "con-horarios";

        /// <summary>The business is open but nothing is free (full, past, or nobody works that day).</summary>
        public const string SinHorarios = "sin-horarios";

        /// <summary>The business is closed: a blocked date or a weekday without opening hours.</summary>
        public const string Cerrado = "cerrado";
    }
}
