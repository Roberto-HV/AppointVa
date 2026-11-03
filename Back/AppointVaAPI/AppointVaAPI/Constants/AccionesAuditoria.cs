namespace AppointVaAPI.Constants
{
    /// <summary>
    /// Every value <see cref="Models.AuditLog.Accion"/> can take, with its Spanish label and group.
    /// Single source for the audit page: GET /api/admin/audit/acciones serves <see cref="Catalogo"/>,
    /// so the filter and the labels in the front cannot fall behind what the backend writes.
    /// Calls to IAuditService must use these constants, never a string literal
    /// (AccionesAuditoriaTests scans the controllers for literals).
    /// </summary>
    public static class AccionesAuditoria
    {
        // ── Groups ──────────────────────────────────────────────────────────────
        public const string GrupoAcceso = "acceso";
        public const string GrupoCuenta = "cuenta";
        public const string GrupoKiosco = "kiosco";
        public const string GrupoDatos = "datos";
        public const string GrupoAdministracion = "administracion";

        // ── Sign-in ─────────────────────────────────────────────────────────────
        public const string Login = "Login";
        public const string LoginFallido = "LoginFallido";
        public const string Logout = "Logout";

        // ── Own account and 2FA ─────────────────────────────────────────────────
        public const string CambiarPassword = "CambiarPassword";
        public const string EliminarCuenta = "EliminarCuenta";
        public const string DosFactoresActivado = "2FAActivado";
        public const string DosFactoresDesactivado = "2FADesactivado";
        public const string CodigosRecuperacionRegenerados = "CodigosRecuperacionRegenerados";
        public const string CodigosRecuperacionRegeneracionFallida = "CodigosRecuperacionRegeneracionFallida";
        public const string CodigoRecuperacionUsado = "CodigoRecuperacionUsado";
        public const string CodigoRecuperacionFallido = "CodigoRecuperacionFallido";

        // ── Reception kiosk (B9) ────────────────────────────────────────────────
        public const string KioscoIniciado = "KioscoIniciado";
        public const string KioscoSalida = "KioscoSalida";
        public const string KioscoSalidaFallida = "KioscoSalidaFallida";
        public const string KioscoSalidaBloqueada = "KioscoSalidaBloqueada";

        // ── Client data ─────────────────────────────────────────────────────────
        public const string ExportarClientes = "ExportarClientes";

        // ── SuperAdmin actions (Entidad "Negocio", EntidadId = the affected business) ──
        public const string NegocioCreado = "NegocioCreado";
        public const string NegocioActivado = "NegocioActivado";
        public const string NegocioDesactivado = "NegocioDesactivado";
        public const string NegocioArchivado = "NegocioArchivado";
        public const string NegocioEliminado = "NegocioEliminado";
        public const string PropietarioCreado = "PropietarioCreado";
        public const string PasswordPropietarioRestablecido = "PasswordPropietarioRestablecido";
        public const string CorreoConfirmadoManual = "CorreoConfirmadoManual";
        public const string ColoresCambiados = "ColoresCambiados";
        public const string PlanCambiado = "PlanCambiado";
        public const string SectorCambiado = "SectorCambiado";
        public const string ModuloPagosCambiado = "ModuloPagosCambiado";
        public const string TesterCambiado = "TesterCambiado";
        public const string EmpleadosExtraCambiado = "EmpleadosExtraCambiado";
        public const string PagoRegistrado = "PagoRegistrado";
        public const string PagoEditado = "PagoEditado";
        public const string PagoEliminado = "PagoEliminado";
        public const string PanelTareasAbierto = "PanelTareasAbierto";

        /// <summary>Entity name used by every SuperAdmin entry.</summary>
        public const string EntidadNegocio = "Negocio";

        public static readonly IReadOnlyList<GrupoAuditoria> Grupos =
        [
            new(GrupoAcceso, "Inicios de sesión"),
            new(GrupoCuenta, "Cuenta y seguridad"),
            new(GrupoKiosco, "Recepción (kiosco)"),
            new(GrupoDatos, "Datos de clientes"),
            new(GrupoAdministracion, "Administración"),
        ];

        public static readonly IReadOnlyList<AccionAuditoria> Catalogo =
        [
            new(Login, "Inicio de sesión", GrupoAcceso),
            new(LoginFallido, "Inicio de sesión fallido", GrupoAcceso),
            new(Logout, "Cierre de sesión", GrupoAcceso),

            new(CambiarPassword, "Cambio de contraseña", GrupoCuenta),
            new(EliminarCuenta, "Eliminación de cuenta", GrupoCuenta),
            new(DosFactoresActivado, "Verificación en dos pasos activada", GrupoCuenta),
            new(DosFactoresDesactivado, "Verificación en dos pasos desactivada", GrupoCuenta),
            new(CodigosRecuperacionRegenerados, "Códigos de recuperación generados", GrupoCuenta),
            new(CodigosRecuperacionRegeneracionFallida, "Generación de códigos rechazada", GrupoCuenta),
            new(CodigoRecuperacionUsado, "Código de recuperación usado", GrupoCuenta),
            new(CodigoRecuperacionFallido, "Código de recuperación incorrecto", GrupoCuenta),

            new(KioscoIniciado, "Kiosco iniciado", GrupoKiosco),
            new(KioscoSalida, "Salida del kiosco", GrupoKiosco),
            new(KioscoSalidaFallida, "Salida del kiosco fallida", GrupoKiosco),
            new(KioscoSalidaBloqueada, "Salida del kiosco bloqueada", GrupoKiosco),

            new(ExportarClientes, "Exportación de clientes", GrupoDatos),

            new(NegocioCreado, "Negocio creado", GrupoAdministracion),
            new(NegocioActivado, "Negocio activado", GrupoAdministracion),
            new(NegocioDesactivado, "Negocio desactivado", GrupoAdministracion),
            new(NegocioArchivado, "Negocio archivado", GrupoAdministracion),
            new(NegocioEliminado, "Negocio eliminado", GrupoAdministracion),
            new(PropietarioCreado, "Propietario creado", GrupoAdministracion),
            new(PasswordPropietarioRestablecido, "Contraseña del propietario restablecida", GrupoAdministracion),
            new(CorreoConfirmadoManual, "Correo confirmado por el admin", GrupoAdministracion),
            new(ColoresCambiados, "Colores cambiados", GrupoAdministracion),
            new(PlanCambiado, "Plan cambiado", GrupoAdministracion),
            new(SectorCambiado, "Sector cambiado", GrupoAdministracion),
            new(ModuloPagosCambiado, "Módulo de pagos cambiado", GrupoAdministracion),
            new(TesterCambiado, "Modo tester cambiado", GrupoAdministracion),
            new(EmpleadosExtraCambiado, "Empleados extra cambiados", GrupoAdministracion),
            new(PagoRegistrado, "Pago registrado", GrupoAdministracion),
            new(PagoEditado, "Pago editado", GrupoAdministracion),
            new(PagoEliminado, "Pago eliminado", GrupoAdministracion),
            new(PanelTareasAbierto, "Panel de tareas abierto", GrupoAdministracion),
        ];

        /// <summary>Actions of one group, for the audit list's <c>grupo</c> filter.</summary>
        public static string[] DelGrupo(string grupo) =>
            Catalogo.Where(a => a.Grupo == grupo).Select(a => a.Accion).ToArray();
    }

    public sealed record AccionAuditoria(string Accion, string Etiqueta, string Grupo);

    public sealed record GrupoAuditoria(string Id, string Etiqueta);
}
