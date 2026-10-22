using AppointVaAPI.Data;
using AppointVaAPI.Helpers;
using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;

namespace AppointVaAPI.Services
{
    public class AuditService : IAuditService
    {
        /// <summary>Time zone of <see cref="AuditLog.FechaEn"/> (stored as local time without offset).</summary>
        public const string ZonaHorariaRegistro = "America/Mexico_City";

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
                await GuardarAsync(accion, entidad, entidadId, detalles, usuarioId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo registrar AuditLog para accion {Accion}", accion);
            }
        }

        public async Task<bool> RegistrarObligatorioAsync(string accion, string? entidad = null, string? entidadId = null, string? detalles = null, Guid? usuarioId = null)
        {
            try
            {
                await GuardarAsync(accion, entidad, entidadId, detalles, usuarioId);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "No se pudo registrar AuditLog obligatorio para accion {Accion}; la operación se rechaza", accion);
                return false;
            }
        }

        private async Task GuardarAsync(string accion, string? entidad, string? entidadId, string? detalles, Guid? usuarioId)
        {
            var ctx = _httpContextAccessor.HttpContext;

            // Si no se pasa usuarioId explícito, lo leer del claim del request
            if (!usuarioId.HasValue)
            {
                var idStr = ctx?.User.FindFirst("sub")?.Value;
                if (Guid.TryParse(idStr, out var id))
                    usuarioId = id;
            }

            // IP real: UseForwardedHeaders ya la resolvió desde el salto de confianza de
            // Render. No leer X-Forwarded-For a mano: su primer valor lo elige el cliente.
            var ip = ctx?.Connection.RemoteIpAddress?.ToString();

            var registro = new AuditLog
            {
                Id        = Guid.NewGuid(),
                UsuarioId = usuarioId,
                Accion    = accion,
                Entidad   = entidad,
                EntidadId = entidadId,
                Detalles  = detalles,
                IpAddress = ip?[..Math.Min(ip.Length, 50)],
                FechaEn   = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ZonaHorariaHelper.Resolver(ZonaHorariaRegistro))
            };
            _db.AuditLogs.Add(registro);

            try
            {
                await _db.SaveChangesAsync();
            }
            catch
            {
                // Do not leave the failed row tracked: a later SaveChanges in the same
                // request would retry it (and fail again) on behalf of unrelated work.
                _db.Entry(registro).State = Microsoft.EntityFrameworkCore.EntityState.Detached;
                throw;
            }
        }
    }
}
