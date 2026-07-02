using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;

namespace AppointVaAPI.Services
{
    public class AuditService : IAuditService
    {
        private readonly ApplicationDbContext _db;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly ILogger<AuditService> _logger;

        public AuditService(ApplicationDbContext db, IHttpContextAccessor httpContextAccessor, ILogger<AuditService> logger)
        {
            _db = db;
            _httpContextAccessor = httpContextAccessor;
            _logger = logger;
        }

        public async Task RegistrarAsync(string accion, string? entidad = null, string? entidadId = null, string? detalles = null, Guid? usuarioId = null)
        {
            try
            {
                var ctx = _httpContextAccessor.HttpContext;

                // Si no se pasa usuarioId explícito, lo leer del claim del request
                if (!usuarioId.HasValue)
                {
                    var idStr = ctx?.User.FindFirst("sub")?.Value;
                    if (Guid.TryParse(idStr, out var id))
                        usuarioId = id;
                }

                // IP real (Render usa proxy; X-Forwarded-For contiene la IP del cliente)
                var ip = ctx?.Request.Headers["X-Forwarded-For"].FirstOrDefault()
                    ?? ctx?.Connection.RemoteIpAddress?.ToString();

                _db.AuditLogs.Add(new AuditLog
                {
                    Id        = Guid.NewGuid(),
                    UsuarioId = usuarioId,
                    Accion    = accion,
                    Entidad   = entidad,
                    EntidadId = entidadId,
                    Detalles  = detalles,
                    IpAddress = ip?[..Math.Min(ip.Length, 50)],
                    FechaEn   = DateTime.UtcNow
                });

                await _db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo registrar AuditLog para accion {Accion}", accion);
            }
        }
    }
}
