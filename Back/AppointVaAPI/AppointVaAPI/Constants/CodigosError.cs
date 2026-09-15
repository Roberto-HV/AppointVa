namespace AppointVaAPI.Constants
{
    // Discriminadores legibles por máquina que acompañan a las respuestas de error,
    // para que el cliente no tenga que inspeccionar el texto de 'mensaje'.
    public static class CodigosError
    {
        public const string HorarioNoDisponible = "HORARIO_NO_DISPONIBLE";
        public const string ClienteNombreDistinto = "CLIENTE_NOMBRE_DISTINTO";
    }
}
