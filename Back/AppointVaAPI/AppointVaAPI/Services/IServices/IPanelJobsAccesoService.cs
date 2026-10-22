namespace AppointVaAPI.Services.IServices
{
    /// <summary>
    /// S2: access to the Hangfire dashboard without putting a JWT in a URL.
    /// A SuperAdmin asks for a short-lived, single-use ticket (Authorization header),
    /// the browser opens /hangfire-session?ticket=…, and the ticket is exchanged once
    /// for an opaque dashboard session id carried in an httpOnly cookie.
    /// State lives in process memory: with more than one API instance, the ticket and
    /// the session only work on the instance that issued them (use a shared store or
    /// sticky sessions before scaling out).
    /// Named without "Hangfire" on purpose: the integration test factory strips every
    /// service whose type name contains "Hangfire".
    /// </summary>
    public interface IPanelJobsAccesoService
    {
        TimeSpan DuracionTicket { get; }
        TimeSpan DuracionSesion { get; }

        /// <summary>Issues a random single-use ticket for the given SuperAdmin.</summary>
        string EmitirTicket(Guid usuarioId);

        /// <summary>Consumes the ticket (valid or not, it can never be used again) and returns a new session id, or null.</summary>
        string? CanjearTicket(string? ticket);

        /// <summary>How long a positive user re-check is trusted before running it again.</summary>
        TimeSpan IntervaloReverificacion { get; }

        /// <summary>
        /// True when the session exists, has not expired, and its user still passes
        /// <paramref name="usuarioAutorizado"/> (re-run at most once per <see cref="IntervaloReverificacion"/>).
        /// A failed check revokes every session and ticket of that user.
        /// </summary>
        Task<bool> SesionValidaAsync(string? sesionId, Func<Guid, Task<bool>> usuarioAutorizado);

        /// <summary>Drops every pending ticket and dashboard session of the user (e.g. on logout).</summary>
        void RevocarSesionesDeUsuario(Guid usuarioId);
    }
}
