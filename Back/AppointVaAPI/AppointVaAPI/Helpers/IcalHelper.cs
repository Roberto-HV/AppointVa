using System.Text;

namespace AppointVaAPI.Helpers
{
    /// <summary>
    /// Genera el .ics de una cita (RFC 5545). Apple Calendar es estricto: cada línea
    /// termina en CRLF (también la última), los textos escapan \ ; , y saltos de
    /// línea, los parámetros con espacios o comas van entre comillas y ninguna línea
    /// pasa de 75 octetos (se pliegan con CRLF + espacio, sin partir un carácter UTF-8).
    /// </summary>
    public static class IcalHelper
    {
        /// <summary>
        /// URL pública del .ics de una cita. `BackendUrl` es el origen del API; se toleran
        /// una barra final o un "/api" final (el mismo valor que VITE_API_URL), que
        /// producían "//api" o "/api/api" y el calendario recibía un 404.
        /// Null cuando no hay BackendUrl configurado.
        /// </summary>
        public static string? UrlPublica(string? backendUrl, string codigo)
        {
            if (string.IsNullOrWhiteSpace(backendUrl)) return null;
            var origen = backendUrl.Trim().TrimEnd('/');
            if (origen.EndsWith("/api", StringComparison.OrdinalIgnoreCase))
                origen = origen[..^4];
            return $"{origen}/api/publico/citas/{Uri.EscapeDataString(codigo)}/ical";
        }

        public sealed record EventoIcal(
            string Uid,
            DateTime InicioUtc,
            DateTime FinUtc,
            DateTime MarcaUtc,
            string Resumen,
            string Descripcion,
            string? Lugar,
            string? OrganizadorNombre,
            string? OrganizadorEmail);

        public static string Generar(EventoIcal e)
        {
            var sb = new StringBuilder();
            void Linea(string contenido) => sb.Append(Plegar(contenido)).Append("\r\n");

            Linea("BEGIN:VCALENDAR");
            Linea("VERSION:2.0");
            Linea("PRODID:-//AppointVa//AppointVa//ES");
            Linea("CALSCALE:GREGORIAN");
            Linea("METHOD:PUBLISH");
            Linea("BEGIN:VEVENT");
            Linea($"UID:{e.Uid}");
            Linea($"DTSTAMP:{Utc(e.MarcaUtc)}");
            Linea($"DTSTART:{Utc(e.InicioUtc)}");
            Linea($"DTEND:{Utc(e.FinUtc)}");
            Linea($"SUMMARY:{EscaparTexto(e.Resumen)}");
            Linea($"DESCRIPTION:{EscaparTexto(e.Descripcion)}");
            if (!string.IsNullOrWhiteSpace(e.Lugar))
                Linea($"LOCATION:{EscaparTexto(e.Lugar)}");
            if (!string.IsNullOrWhiteSpace(e.OrganizadorEmail))
            {
                var cn = string.IsNullOrWhiteSpace(e.OrganizadorNombre)
                    ? string.Empty
                    : $";CN={ParametroEntreComillas(e.OrganizadorNombre)}";
                Linea($"ORGANIZER{cn}:mailto:{e.OrganizadorEmail.Trim()}");
            }
            Linea("STATUS:CONFIRMED");
            Linea("SEQUENCE:0");
            Linea("BEGIN:VALARM");
            Linea("ACTION:DISPLAY");
            Linea("DESCRIPTION:Recordatorio de cita");
            Linea("TRIGGER:-PT1H");
            Linea("END:VALARM");
            Linea("END:VEVENT");
            Linea("END:VCALENDAR");
            return sb.ToString();
        }

        private static string Utc(DateTime d) =>
            DateTime.SpecifyKind(d, DateTimeKind.Utc).ToString("yyyyMMdd'T'HHmmss'Z'");

        /// <summary>TEXT de RFC 5545 §3.3.11: \\ \; \, y los saltos como \n.</summary>
        public static string EscaparTexto(string? valor)
        {
            if (string.IsNullOrEmpty(valor)) return string.Empty;
            return valor
                .Replace("\\", "\\\\")
                .Replace(";", "\\;")
                .Replace(",", "\\,")
                .Replace("\r\n", "\\n")
                .Replace("\n", "\\n")
                .Replace("\r", "\\n");
        }

        /// <summary>Un parámetro (p. ej. CN) entre comillas; las comillas dobles no se admiten dentro.</summary>
        private static string ParametroEntreComillas(string valor) =>
            $"\"{valor.Replace("\"", "'").Replace("\r", " ").Replace("\n", " ").Trim()}\"";

        /// <summary>Pliega a 75 octetos UTF-8 por línea (§3.1) sin partir caracteres.</summary>
        public static string Plegar(string linea)
        {
            const int max = 75;
            if (Encoding.UTF8.GetByteCount(linea) <= max) return linea;

            var sb = new StringBuilder();
            var octetos = 0;
            var limite = max;
            var e = System.Globalization.StringInfo.GetTextElementEnumerator(linea);
            while (e.MoveNext())
            {
                var elemento = (string)e.Current;
                var n = Encoding.UTF8.GetByteCount(elemento);
                if (octetos + n > limite)
                {
                    sb.Append("\r\n ");
                    octetos = 0;
                    limite = max - 1; // el espacio inicial cuenta
                }
                sb.Append(elemento);
                octetos += n;
            }
            return sb.ToString();
        }
    }
}
