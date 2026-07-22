using AppointVaAPI.Models;

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
    }
}
