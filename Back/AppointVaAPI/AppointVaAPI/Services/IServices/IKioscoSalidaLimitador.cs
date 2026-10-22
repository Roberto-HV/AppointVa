namespace AppointVaAPI.Services.IServices
{
    /// <summary>
    /// Server-side limit on password attempts to leave the reception screen (B9).
    /// Kept apart from the Identity lockout so a guess on the kiosk never locks the owner out.
    /// </summary>
    public interface IKioscoSalidaLimitador
    {
        /// <summary>
        /// Takes one attempt for the negocio. False when none is left in the window;
        /// <paramref name="reintentarEn"/> is then the real time until one frees up.
        /// <paramref name="fallosPersistidos"/> are the negocio's recent failures from durable
        /// storage, so a restart or another instance does not reset the budget.
        /// </summary>
        bool Intentar(Guid negocioId, IReadOnlyCollection<DateTimeOffset> fallosPersistidos, out TimeSpan reintentarEn);

        /// <summary>Attempts still available for the negocio, and when it may retry if none are.</summary>
        int Restantes(Guid negocioId, out TimeSpan reintentarEn);
    }
}
