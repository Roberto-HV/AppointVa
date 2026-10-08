namespace AppointVaAPI.Models.Dtos.Clientes
{
    /// <summary>
    /// Reparto del directorio completo por actividad. El listado de /api/clientes
    /// está paginado, así que estos tres grupos no pueden derivarse de una página.
    /// </summary>
    public class ResumenActividadDto
    {
        public int Total { get; set; }
        public int Activos { get; set; }
        public int Inactivos { get; set; }
        public int SinVisitas { get; set; }
    }
}
