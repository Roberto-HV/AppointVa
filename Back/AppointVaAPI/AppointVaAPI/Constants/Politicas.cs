namespace AppointVaAPI.Constants
{
    /// <summary>
    /// Named authorization policies.
    /// </summary>
    public static class Politicas
    {
        /// <summary>
        /// Full business management (decision 2, DC-14): everything the restricted
        /// Empleado role may not do — exports, cash closing, payment reversal,
        /// deposit annulment and global client edits. Mirrors the frontend matrix
        /// in Front/src/hooks/usePermisos.ts.
        /// </summary>
        public const string GestionCompleta = "GestionCompleta";

        /// <summary>Roles that satisfy <see cref="GestionCompleta"/>.</summary>
        public static readonly string[] RolesGestionCompleta = [Roles.Propietario, Roles.SuperAdmin];

        /// <summary>
        /// Reception screen (B9, decision 3): only the kiosk token, bound to one negocio.
        /// The default policy rejects that token, so it cannot reach any other endpoint.
        /// </summary>
        public const string Kiosco = "Kiosco";

        /// <summary>Rate limit policy (not an authorization policy) for client-data exports (B18 / S7).</summary>
        public const string LimiteExportacion = "Exportacion";
    }
}
