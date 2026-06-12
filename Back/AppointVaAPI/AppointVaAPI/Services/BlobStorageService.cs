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

            return _cloudinaryConfigurado
                ? await SubirACloudinaryAsync(archivo, carpeta)
                : await GuardarLocalAsync(archivo, carpeta);
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
