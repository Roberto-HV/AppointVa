namespace AppointVaAPI.Constants
{
    // Métodos aceptados en el cobro. El orden es el que espera el desglose del panel.
    public static class MetodosPago
    {
        public const string Efectivo      = "Efectivo";
        public const string Tarjeta       = "Tarjeta";
        public const string Transferencia = "Transferencia";

        public static readonly string[] Todos = { Efectivo, Tarjeta, Transferencia };
    }
}
