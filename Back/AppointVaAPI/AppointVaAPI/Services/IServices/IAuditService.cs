namespace AppointVaAPI.Services.IServices
{
    public interface IAuditService
    {
        Task RegistrarAsync(string accion, string? entidad = null, string? entidadId = null, string? detalles = null, Guid? usuarioId = null);
    }
}
