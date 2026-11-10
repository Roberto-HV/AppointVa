namespace AppointVaAPI.Models.Dtos.Publico
{
    public class ConfirmacionCitaDto
    {
        public Guid Id { get; set; }
        public string CodigoConfirmacion { get; set; } = string.Empty;
        public string NombreNegocio { get; set; } = string.Empty;
        public string NegocioSlug { get; set; } = string.Empty;
        public Guid ServicioId { get; set; }
        public Guid EmpleadoId { get; set; }
        public string NombreServicio { get; set; } = string.Empty;
        public string NombreEmpleado { get; set; } = string.Empty;
        public string NombreCliente { get; set; } = string.Empty;
        /// <summary>
        /// Eco del correo que trajo quien reserva: sólo viaja en la respuesta de POST
        /// /publico/citas, donde es su propio dato de vuelta. La consulta por código lo
        /// deja en null aunque el cliente sí tenga correo en archivo; para saber si lo
        /// tiene está <see cref="TieneEmail"/>.
        /// </summary>
        public string? EmailCliente { get; set; }
        /// <summary>
        /// Hay un correo en archivo al que salió la confirmación y con el que se autoriza
        /// cancelar o reagendar; la dirección no viaja. Es el campo por el que la página
        /// decide si ofrece autogestión, nunca <see cref="EmailCliente"/>.
        /// </summary>
        public bool TieneEmail { get; set; }
        public DateTime InicioEn { get; set; }
        public DateTime FinEn { get; set; }
        public decimal Precio { get; set; }
        public byte Estado { get; set; }
        public string EstadoTexto { get; set; } = string.Empty;
        public string? Notas { get; set; }
        public string? GoogleCalUrl { get; set; }
        public int HorasCancelacion { get; set; }
        // B2: minimum notice in days, so the reschedule picker hides days the business does not accept.
        public int DiasAnticipacionMinima { get; set; }
        // B4: business sector ("belleza" | "salud") for the receipt wording after a direct visit.
        public string Sector { get; set; } = "belleza";
        public bool RequiereAnticipo { get; set; }
        public decimal? MontoAnticipo { get; set; }
        public string? InstruccionesAnticipo { get; set; }
        public int PorcentajeAnticipo { get; set; }
        public string PoliticaCancelacionAnticipo { get; set; } = string.Empty;
        public string? ComprobanteUrl { get; set; }
        public string? InstagramUrl { get; set; }
        public string? FacebookUrl { get; set; }
        public string? TiktokUrl { get; set; }
        public string ColorPrimario { get; set; } = "#334155";
    }
}
