using AppointVaAPI.Models;

namespace AppointVaAPI.Services.IServices
{
    public interface IEmailService
    {
        Task EnviarConfirmacionCitaAsync(Cita cita, string emailDestino, string nombreCliente, string? urlCita = null, string? icalUrl = null, string? googleCalUrl = null);
        Task EnviarCancelacionCitaAsync(Cita cita, string emailDestino, string nombreCliente);
        Task EnviarRecordatorioCitaAsync(Cita cita, string emailDestino, string nombreCliente, string? icalUrl = null, string? googleCalUrl = null);
        Task EnviarRecordatorioEmpleadoAsync(Cita cita, string emailDestino);
        Task EnviarRecuperacionContrasenaAsync(string emailDestino, string nombre, string urlReset);
        Task EnviarNuevaCitaPropietarioAsync(Cita cita, string emailDestino);
        Task EnviarCancelacionClienteAlPropietarioAsync(Cita cita, string emailDestino);
        Task EnviarReagendarCitaAsync(Cita cita, string emailDestino, string nombreCliente, DateTime fechaOriginal);
        Task EnviarVerificacionEmailAsync(string emailDestino, string nombre, string urlVerificacion);
    }
}
