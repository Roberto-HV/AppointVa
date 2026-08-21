namespace AppointVaAPI.Services.IServices
{
    public interface IBlobStorageService
    {
        // Sube una imagen y devuelve la URL pública segura (HTTPS).
        // carpeta: subcarpeta en Cloudinary, ej: "negocios/logos"
        Task<string> SubirImagenAsync(IFormFile archivo, string carpeta);

        // Elimina una imagen dado su URL almacenada.
        // No lanza excepciones — registra el error y retorna false si falla.
        Task<bool> EliminarImagenAsync(string url);
    }
}
