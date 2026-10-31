namespace AppointVaAPI.Models.Dtos.Citas
{
    /// <summary>
    /// Everything the receipt email shows. NotificacionJob loads it from the
    /// appointment and its business; the template escapes every text value.
    /// InicioEn is the business's local wall time: it is shown as-is.
    /// </summary>
    public sealed record TicketCitaDatos
    {
        public string ClienteNombre { get; init; } = string.Empty;

        // Business header
        public string NegocioNombre { get; init; } = string.Empty;
        public string? NegocioLogoUrl { get; init; }
        public string? NegocioDireccion { get; init; }
        public string? NegocioTelefono { get; init; }
        public string? Sector { get; init; }

        // Appointment
        public string Folio { get; init; } = string.Empty;
        public DateTime InicioEn { get; init; }
        public string? EmpleadoNombre { get; init; }
        public string Servicio { get; init; } = string.Empty;
        public int DuracionMinutos { get; init; }

        // Amounts: the appointment's stored values as-is (same names as CitaDto), so
        // EmailService.ResumirTicket and the front's resumirTicket read the same input.
        /// <summary>Price stored on the appointment (a booking coupon is already applied).</summary>
        public decimal Precio { get; init; }
        /// <summary>List price stored at booking; NULL on older appointments (no coupon shown).</summary>
        public decimal? PrecioLista { get; init; }
        /// <summary>Coupon percentage stored at booking (10 = 10%); NULL for a fixed amount.</summary>
        public decimal? DescuentoPorcentaje { get; init; }
        public bool AnticipoRecibido { get; init; }
        public decimal? MontoAnticipo { get; init; }
        /// <summary>NULL when the payment did not store it: what was left after the advance.</summary>
        public decimal? MontoCobrado { get; init; }
        public decimal? Propina { get; init; }

        // Payment
        public string? MetodoPago { get; init; }
        public string? MetodoPago2 { get; init; }
        public decimal? MontoPago2 { get; init; }
        public decimal? MontoRecibido { get; init; }
        public decimal? Cambio { get; init; }

        /// <summary>Public booking page (/b/{slug}); null hides the rebooking button.</summary>
        public string? UrlReserva { get; init; }
    }
}
