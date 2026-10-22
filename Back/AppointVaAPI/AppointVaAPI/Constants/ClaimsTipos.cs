namespace AppointVaAPI.Constants
{
    public static class ClaimsTipos
    {
        public const string NegocioId     = "negocio_id";
        public const string NombreCompleto = "nombre_completo";
        public const string Rol            = "role";
        public const string UsuarioId      = "sub";

        // Kiosk token only (B9).
        /// <summary>Role of the account that opened the reception screen (Propietario or Empleado).</summary>
        public const string KioscoRolOrigen = "kiosco_rol_origen";
        /// <summary>Hash of the account's security stamp: a password change or reset ends the kiosk.</summary>
        public const string KioscoSello     = "kiosco_sello";
        /// <summary>Present only on the 2FA challenge JWT, which must never authorize an endpoint.</summary>
        public const string Desafio2FA      = "2fa_challenge";
    }
}
