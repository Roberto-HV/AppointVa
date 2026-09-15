using System.Globalization;
using System.Text;

namespace AppointVaAPI.Helpers
{
    // Normalización compartida para identificar al cliente por teléfono y nombre.
    // Debe usarse en todos los caminos (búsqueda y alta) o el mismo cliente se
    // duplica según cómo haya tecleado el teléfono.
    public static class NormalizacionHelper
    {
        public static string SoloDigitos(string? telefono)
        {
            if (string.IsNullOrEmpty(telefono)) return string.Empty;
            return new string(telefono.Where(char.IsDigit).ToArray());
        }

        /// <summary>
        /// Reduce un nombre a su forma comparable: sin espacios redundantes,
        /// sin acentos y en minúsculas. "elena  López" y "Elena Lopez" coinciden.
        /// </summary>
        public static string NombreComparable(string? nombre)
        {
            if (string.IsNullOrWhiteSpace(nombre)) return string.Empty;

            var sinAcentos = new StringBuilder();
            foreach (var c in nombre.Normalize(NormalizationForm.FormD))
            {
                if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                    sinAcentos.Append(c);
            }

            var colapsado = string.Join(
                ' ',
                sinAcentos.ToString().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

            return colapsado.Normalize(NormalizationForm.FormC).ToLowerInvariant();
        }

        public static bool MismoNombre(string? a, string? b) =>
            NombreComparable(a) == NombreComparable(b);
    }
}
