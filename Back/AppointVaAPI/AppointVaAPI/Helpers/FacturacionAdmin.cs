namespace AppointVaAPI.Helpers
{
    /// <summary>
    /// The billing figures the SuperAdmin sees, defined in one place (lote 2, G3).
    ///
    /// Two concepts that used to be mixed up:
    /// <list type="bullet">
    /// <item><b>Plan asignado</b>: what the business may use. Its list price
    /// (<see cref="PrecioMensual"/>) exists whether or not anybody pays it.</item>
    /// <item><b>Suscripción vigente</b>: a recorded payment whose period has not ended
    /// (<see cref="EsVigente"/>). Only these bring money in.</item>
    /// </list>
    /// <see cref="IngresoMensual"/> is the single per-business figure that the rows, the footer
    /// and the KPIs add up, so they cannot disagree.
    /// </summary>
    public static class FacturacionAdmin
    {
        /// <summary>Monthly price of each employee above the plan's limit.</summary>
        public const decimal PrecioEmpleadoExtra = 50m;

        /// <summary>
        /// "De por vida" is recorded as a 1200-month payment, so it ends a century later.
        /// Anything beyond fifty years is that one-off access, not a monthly subscription.
        /// </summary>
        public const int DiasAccesoPermanente = 365 * 50;

        public const string Activa = "Activa";
        public const string PorVencer = "PorVencer";
        public const string Vencida = "Vencida";
        public const string SinSuscripcion = "SinSuscripcion";

        /// <summary>List price of the assigned plan plus extra employees, paid or not.</summary>
        public static decimal PrecioMensual(decimal precioPlan, int empleadosExtra) =>
            precioPlan + empleadosExtra * PrecioEmpleadoExtra;

        /// <summary>
        /// Assigning a plan turns the payments module on only when its name contains "Pro".
        /// SetPlan applies it and /api/planes exposes it, so the front never re-derives it.
        /// </summary>
        public static bool PlanHabilitaModuloPagos(string? nombrePlan) =>
            nombrePlan?.Contains("Pro", StringComparison.OrdinalIgnoreCase) ?? false;

        public static int? DiasRestantes(DateTime? fechaVencimiento, DateTime hoy) =>
            fechaVencimiento.HasValue ? (int)(fechaVencimiento.Value.Date - hoy.Date).TotalDays : null;

        public static string Estado(int? diasRestantes) => diasRestantes switch
        {
            null => SinSuscripcion,
            > 7  => Activa,
            >= 0 => PorVencer,
            _    => Vencida
        };

        /// <summary>A recorded payment covers today.</summary>
        public static bool EsVigente(string estado) => estado is Activa or PorVencer;

        public static bool EsAccesoPermanente(int? diasRestantes) => diasRestantes >= DiasAccesoPermanente;

        /// <summary>A payment of fifty years or more is the lifetime access ("De por vida", 1200 months).</summary>
        public static bool EsPagoDeAccesoPermanente(int mesesPagados) => mesesPagados >= 12 * 50;

        /// <summary>
        /// What the business adds to the monthly recurring income: its monthly price while the
        /// subscription is current. Zero without a payment, once it expired, for test businesses
        /// (they never pay) and for lifetime access (paid once, nothing comes in each month).
        /// </summary>
        public static decimal IngresoMensual(string estado, int? diasRestantes, bool esTester, decimal precioMensual) =>
            EsVigente(estado) && !esTester && !EsAccesoPermanente(diasRestantes) ? precioMensual : 0m;
    }
}
