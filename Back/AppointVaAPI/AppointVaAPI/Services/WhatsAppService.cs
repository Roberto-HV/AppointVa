using AppointVaAPI.Services.IServices;
using System.Text;
using System.Text.Json;

namespace AppointVaAPI.Services
{
    public class WhatsAppService : IWhatsAppService
    {
        private readonly IConfiguration _config;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<WhatsAppService> _logger;

        private const string GraphApiBase = "https://graph.facebook.com/v19.0";

        public WhatsAppService(
            IConfiguration config,
            IHttpClientFactory httpClientFactory,
            ILogger<WhatsAppService> logger)
        {
            _config = config;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        public bool EstaHabilitado()
        {
            var habilitado = _config.GetValue<bool>("WhatsApp:Habilitado");
            var phoneId = _config["WhatsApp:PhoneNumberId"];
            var token = _config["WhatsApp:ApiToken"];
            return habilitado
                && !string.IsNullOrWhiteSpace(phoneId)
                && phoneId != "REEMPLAZAR"
                && !string.IsNullOrWhiteSpace(token)
                && token != "REEMPLAZAR";
        }

        public async Task EnviarMensajeAsync(string telefonoDestino, string mensaje)
        {
            var telefono = NormalizarTelefono(telefonoDestino);
            if (string.IsNullOrWhiteSpace(telefono))
            {
                _logger.LogWarning("WhatsApp: número de destino inválido '{Telefono}'", telefonoDestino);
                return;
            }

            if (!EstaHabilitado())
            {
                // Modo desarrollo: sólo registrar el mensaje en el log
                _logger.LogInformation(
                    "[WhatsApp-DEV] Para: {Telefono}\n{Mensaje}",
                    telefono, mensaje);
                return;
            }

            var phoneNumberId = _config["WhatsApp:PhoneNumberId"];
            var apiToken = _config["WhatsApp:ApiToken"];

            var body = new
            {
                messaging_product = "whatsapp",
                to = telefono,
                type = "text",
                text = new { body = mensaje }
            };

            var json = JsonSerializer.Serialize(body);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var client = _httpClientFactory.CreateClient("WhatsApp");
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiToken);

            try
            {
                var response = await client.PostAsync(
                    $"{GraphApiBase}/{phoneNumberId}/messages", content);

                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError(
                        "WhatsApp API error {Status}: {Error}",
                        response.StatusCode, error);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "WhatsApp: error al enviar mensaje a {Telefono}", telefono);
            }
        }

        // Convierte cualquier formato a número internacional sin + ni espacios (ej: 5215512345678)
        private static string NormalizarTelefono(string? telefono)
        {
            if (string.IsNullOrWhiteSpace(telefono)) return string.Empty;

            var solo = new string(telefono.Where(char.IsDigit).ToArray());

            // Si empieza con 52 (México) y tiene 12 dígitos, ya está bien
            if (solo.StartsWith("52") && solo.Length == 12) return solo;

            // Si tiene 10 dígitos (número local México sin código de país)
            if (solo.Length == 10) return "52" + solo;

            // Si tiene 11 y empieza con 1 (USA/CAN)
            if (solo.Length == 11 && solo.StartsWith("1")) return solo;

            return solo;
        }
    }
}
