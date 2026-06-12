namespace AppointVaAPI.Models.Dtos.Dashboard
{
    public class PuntoDatosDto
    {
        public string Etiqueta { get; set; } = string.Empty;
        public int Citas { get; set; }
        public decimal Ingresos { get; set; }
    }
}
