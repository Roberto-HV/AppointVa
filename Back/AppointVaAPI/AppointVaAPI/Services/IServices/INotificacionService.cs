using AppointVaAPI.Models;

namespace AppointVaAPI.Services.IServices
{
    /// <summary>
    /// Servicio de notificaciones para eventos de citas.
    /// Enruta automáticamente por WhatsApp, correo o ambos según la config del negocio.
    /// Los correos de autenticación (verificación, recuperación) siempre usan IEmailService directamente.
    /// </summary>
    public interface INotificacionService
    {
        Task EnviarConfirmacionCitaAsync(Cita cita, string emailDestino, string nombreCliente,
            string? urlCita = null, string? icalUrl = null, string? googleCalUrl = null);

        Task EnviarCancelacionCitaAsync(Cita cita, string emailDestino, string nombreCliente);

        Task EnviarRecordatorioCitaAsync(Cita cita, string emailDestino, string nombreCliente,
            string? icalUrl = null, string? googleCalUrl = null);

        Task EnviarRecordatorioEmpleadoAsync(Cita cita, string emailDestino);

        Task EnviarNuevaCitaPropietarioAsync(Cita cita, string emailDestino);

        Task EnviarCancelacionClienteAlPropietarioAsync(Cita cita, string emailDestino);

        Task EnviarReagendarCitaAsync(Cita cita, string emailDestino, string nombreCliente,
            DateTime fechaOriginal);

        Task EnviarSolicitudResenaAsync(Cita cita, string emailDestino, string nombreCliente,
            string urlResena);
    }
}
