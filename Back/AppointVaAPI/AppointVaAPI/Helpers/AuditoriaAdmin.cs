using AppointVaAPI.Constants;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Mvc;

namespace AppointVaAPI.Helpers
{
    /// <summary>
    /// Audit entries for SuperAdmin actions: always Entidad "Negocio" with the affected business id,
    /// so the audit page can show the business name. The actor comes from the request's "sub".
    ///
    /// Fail-open (<see cref="RegistrarNegocioAsync"/>) for reversible settings; fail-closed
    /// (<see cref="RegistrarNegocioObligatorioAsync"/>) for actions that destroy data, touch money
    /// records or set someone else's credentials — those run inside a transaction with their entry,
    /// so either both are saved or neither is.
    ///
    /// The detail is a short, non-sensitive summary: never passwords, tokens or free-text notes.
    /// </summary>
    public static class AuditoriaAdmin
    {
        /// <summary>Same length as <see cref="Models.AuditLog.Detalles"/>; longer text would fail the insert.</summary>
        public const int LargoMaximoDetalle = 500;

        public const string MensajeNoDisponible =
            "No pudimos registrar la acción en la bitácora, así que no se aplicó. Intenta de nuevo en unos minutos.";

        public static Task RegistrarNegocioAsync(this IAuditService audit, string accion, Guid negocioId, string? detalles = null) =>
            audit.RegistrarAsync(accion, AccionesAuditoria.EntidadNegocio, negocioId.ToString(), Recortar(detalles));

        public static Task<bool> RegistrarNegocioObligatorioAsync(this IAuditService audit, string accion, Guid negocioId, string? detalles = null) =>
            audit.RegistrarObligatorioAsync(accion, AccionesAuditoria.EntidadNegocio, negocioId.ToString(), Recortar(detalles));

        /// <summary>503 for an action whose mandatory audit row could not be written.</summary>
        public static IActionResult NoDisponible(ControllerBase controlador) =>
            controlador.StatusCode(StatusCodes.Status503ServiceUnavailable, new { mensaje = MensajeNoDisponible });

        /// <summary>"Sí"/"No" for toggles in the detail text.</summary>
        public static string SiNo(bool valor) => valor ? "Sí" : "No";

        private static string? Recortar(string? texto) =>
            texto is { Length: > LargoMaximoDetalle } ? texto[..LargoMaximoDetalle] : texto;
    }
}
