namespace AppointVaAPI.Constants
{
    // Corresponden al campo byte Estado en la entidad Cita
    public static class EstadosCitas
    {
        public const byte Pendiente    = 1;
        public const byte Confirmada   = 2;
        public const byte Completada   = 3;
        public const byte Cancelada    = 4;
        public const byte Inasistencia = 5;
    }
}
