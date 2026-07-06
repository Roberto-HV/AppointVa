namespace AppointVaAPI.Services.IServices
{
    public interface IPushService
    {
        Task GuardarSuscripcionAsync(Guid usuarioId, string endpoint, string p256dh, string auth);
        Task EliminarSuscripcionAsync(Guid usuarioId);
        Task EnviarNuevaCitaEmpleadoAsync(Guid citaId);
        Task<string> EnviarPruebaAsync(Guid usuarioId);
        Task<string> EnviarPruebaVaciaAsync(Guid usuarioId);
    }
}
