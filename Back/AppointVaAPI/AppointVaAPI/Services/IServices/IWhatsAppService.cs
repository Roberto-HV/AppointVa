namespace AppointVaAPI.Services.IServices
{
    public interface IWhatsAppService
    {
        Task EnviarMensajeAsync(string telefonoDestino, string mensaje);
        bool EstaHabilitado();
    }
}
