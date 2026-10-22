namespace AppointVaAPI.Constants
{
    public static class Roles
    {
        public const string SuperAdmin = "SuperAdmin";
        public const string Propietario = "Propietario";
        public const string Empleado = "Empleado";

        /// <summary>
        /// Reception-screen token (B9, decision 3). Never an Identity role: it only
        /// exists as the role claim of the short-lived JWT issued by POST /api/kiosco/sesion,
        /// and only satisfies <see cref="Politicas.Kiosco"/>.
        /// </summary>
        public const string Kiosco = "Kiosco";
    }
}
