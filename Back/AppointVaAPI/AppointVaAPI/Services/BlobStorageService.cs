using AppointVaAPI.Services.IServices;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;

namespace AppointVaAPI.Services
{
    public class BlobStorageService : IBlobStorageService
    {
        private readonly Cloudinary? _cloudinary;
        private readonly IWebHostEnvironment _env;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly ILogger<BlobStorageService> _logger;
        private readonly bool _cloudinaryConfigurado;

        private static readonly string[] _tiposPermitidos =
            ["image/jpeg", "image/png", "image/webp", "image/gif"];

        // Magic bytes por tipo MIME para validar el contenido real del archivo
        private static readonly Dictionary<string, byte[]> _firmasMime = new()
        {
            ["image/jpeg"] = [0xFF, 0xD8, 0xFF],
            ["image/png"]  = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
            ["image/webp"] = [0x52, 0x49, 0x46, 0x46], // "RIFF" + verificación "WEBP" en offset 8
            ["image/gif"]  = [0x47, 0x49, 0x46, 0x38], // "GIF8"
        };

        private const long MaxBytes = 5 * 1024 * 1024; // 5 MB

        public BlobStorageService(
            IConfiguration config,
            IWebHostEnvironment env,
            IHttpContextAccessor httpContextAccessor,
            ILogger<BlobStorageService> logger)
        {
            _env = env;
            _httpContextAccessor = httpContextAccessor;
            _logger = logger;

            var cloudName = config["Cloudinary:CloudName"];
            var apiKey = config["Cloudinary:ApiKey"];
            var apiSecret = config["Cloudinary:ApiSecret"];

            _cloudinaryConfigurado =
                !string.IsNullOrWhiteSpace(cloudName) &&
                !cloudName.StartsWith("REEMPLAZAR") &&
                !string.IsNullOrWhiteSpace(apiKey) &&
                !apiKey.StartsWith("REEMPLAZAR") &&
                !string.IsNullOrWhiteSpace(apiSecret) &&
                !apiSecret.StartsWith("REEMPLAZAR");

            if (_cloudinaryConfigurado)
            {
                var account = new Account(cloudName, apiKey, apiSecret);
                _cloudinary = new Cloudinary(account) { Api = { Secure = true } };
            }
            else
            {
                _logger.LogWarning(
                    "Cloudinary no está configurado. Las imágenes se guardarán localmente en wwwroot/uploads/.");
            }
        }

        public async Task<string> SubirImagenAsync(IFormFile archivo, string carpeta)
        {
            if (archivo.Length == 0)
                throw new ArgumentException("El archivo está vacío.");

            if (archivo.Length > MaxBytes)
                throw new ArgumentException("El archivo supera el límite de 5 MB.");

            var tipo = archivo.ContentType.ToLowerInvariant();
            if (!_tiposPermitidos.Contains(tipo))
                throw new ArgumentException("Formato no permitido. Usa JPG, PNG, WEBP o GIF.");

            if (!ValidarFirmaArchivo(archivo, tipo))
                throw new ArgumentException("El contenido del archivo no corresponde al tipo declarado.");

            return _cloudinaryConfigurado
                ? await SubirACloudinaryAsync(archivo, carpeta)
                : await GuardarLocalAsync(archivo, carpeta);
        }

        private static bool ValidarFirmaArchivo(IFormFile archivo, string tipoMime)
        {
            if (!_firmasMime.TryGetValue(tipoMime, out var firma)) return false;

            var bufLen = tipoMime == "image/webp" ? 12 : firma.Length;
            Span<byte> buffer = stackalloc byte[bufLen];

            using var stream = archivo.OpenReadStream();
            var leidos = stream.Read(buffer);
            if (leidos < bufLen) return false;

            for (int i = 0; i < firma.Length; i++)
                if (buffer[i] != firma[i]) return false;

            if (tipoMime == "image/webp")
            {
                // bytes 8-11 deben ser "WEBP"
                ReadOnlySpan<byte> webp = [0x57, 0x45, 0x42, 0x50];
                for (int i = 0; i < 4; i++)
                    if (buffer[8 + i] != webp[i]) return false;
            }

            return true;
        }

        private async Task<string> SubirACloudinaryAsync(IFormFile archivo, string carpeta)
        {
            await using var stream = archivo.OpenReadStream();

            var uploadParams = new ImageUploadParams
            {
                File = new FileDescription(archivo.FileName, stream),
                Folder = $"appointva/{carpeta}",
                PublicId = Guid.NewGuid().ToString("N"),
                Transformation = new Transformation()
                    .Quality("auto")
                    .FetchFormat("auto")
            };

            var resultado = await _cloudinary!.UploadAsync(uploadParams);

            if (resultado.Error is not null)
            {
                _logger.LogError("Error Cloudinary: {Error}", resultado.Error.Message);
                throw new InvalidOperationException($"Error al subir imagen: {resultado.Error.Message}");
            }

            return resultado.SecureUrl.ToString();
        }

        private async Task<string> GuardarLocalAsync(IFormFile archivo, string carpeta)
        {
            // wwwroot/uploads/{carpeta}/
            var dirRelativo = Path.Combine("uploads", carpeta.Replace('/', Path.DirectorySeparatorChar));
            var dirAbsoluto = Path.Combine(_env.WebRootPath, dirRelativo);

            Directory.CreateDirectory(dirAbsoluto);

            var extension = Path.GetExtension(archivo.FileName).ToLowerInvariant();
            var nombreArchivo = $"{Guid.NewGuid():N}{extension}";
            var rutaAbsoluta = Path.Combine(dirAbsoluto, nombreArchivo);

            await using var stream = new FileStream(rutaAbsoluta, FileMode.Create);
            await archivo.CopyToAsync(stream);

            // Construye la URL relativa que el frontend puede consumir
            var request = _httpContextAccessor.HttpContext?.Request;
            var baseUrl = request is not null
                ? $"{request.Scheme}://{request.Host}"
                : string.Empty;

            var urlRelativa = $"/uploads/{carpeta.Replace('\\', '/')}/{nombreArchivo}";
            return $"{baseUrl}{urlRelativa}";
        }
    }
}
