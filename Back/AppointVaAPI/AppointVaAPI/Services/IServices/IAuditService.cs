namespace AppointVaAPI.Services.IServices
{
    public interface IAuditService
    {
        /// <summary>Fail-open: a failed write is logged as a warning and swallowed.</summary>
        Task RegistrarAsync(string accion, string? entidad = null, string? entidadId = null, string? detalles = null, Guid? usuarioId = null);

        /// <summary>
        /// Fail-closed: returns false (and logs at Error) when the row could not be written,
        /// so the caller can refuse the action — used where an unaudited action is not acceptable
        /// (data exports).
        /// </summary>
        Task<bool> RegistrarObligatorioAsync(string accion, string? entidad = null, string? entidadId = null, string? detalles = null, Guid? usuarioId = null);
    }
}
