namespace AppointVaAPI.Services.IServices
{
    public interface IBlobStorageService
    {
        // Sube una imagen y devuelve la URL pública segura (HTTPS).
        // carpeta: subcarpeta en Cloudinary, ej: "negocios/logos"
        Task<string> SubirImagenAsync(IFormFile archivo, string carpeta);
    }
}
