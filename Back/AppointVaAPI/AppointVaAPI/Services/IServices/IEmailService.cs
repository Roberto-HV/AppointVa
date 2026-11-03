using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Citas;

namespace AppointVaAPI.Services.IServices
{
    public interface IEmailService
    {
        Task EnviarConfirmacionCitaAsync(Cita cita, string emailDestino, string nombreCliente, string? urlCita = null, string? icalUrl = null, string? googleCalUrl = null, string? urlCancelacion = null);
        Task EnviarCancelacionCitaAsync(Cita cita, string emailDestino, string nombreCliente);
        Task EnviarRecordatorioCitaAsync(Cita cita, string emailDestino, string nombreCliente, string? icalUrl = null, string? googleCalUrl = null);
        Task EnviarRecuperacionContrasenaAsync(string emailDestino, string nombre, string urlReset);
        Task EnviarReagendarCitaAsync(Cita cita, string emailDestino, string nombreCliente, DateTime fechaOriginal);
        Task EnviarVerificacionEmailAsync(string emailDestino, string nombre, string urlVerificacion);
        Task EnviarSolicitudResenaAsync(Cita cita, string emailDestino, string nombreCliente, string urlResena);
        Task EnviarNotificacionListaEsperaAsync(string emailDestino, string nombreCliente, string nombreNegocio, string nombreServicio, string urlReserva);
        Task EnviarBienvenidaAsync(string emailDestino, string nombre, string negocioNombre, string slug, string urlDashboard);
        Task EnviarTicketCitaAsync(string destinoEmail, TicketCitaDatos datos);

        /// <summary>
        /// Lote 5: sending is switched on and configured. Flows that hand a link to someone check it
        /// first and refuse with a clear error instead of pretending the email went out.
        /// </summary>
        bool EnvioDisponible { get; }

        /// <summary>
        /// Lote 5 (I4, I8): invitation or reset link for an owner, sent by the platform. Returns true
        /// only when the provider accepted the message.
        /// </summary>
        Task<bool> EnviarEnlaceAccesoAsync(string emailDestino, string nombre, string urlEnlace, bool esInvitacion, string? negocioNombre);
    }
}
