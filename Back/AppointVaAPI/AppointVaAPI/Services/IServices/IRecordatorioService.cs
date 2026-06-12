namespace AppointVaAPI.Services.IServices
{
    public interface IRecordatorioService
    {
        Task EnviarRecordatorioCitaAsync(Guid citaId);
    }
}
