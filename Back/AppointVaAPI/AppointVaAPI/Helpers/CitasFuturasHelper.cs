using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Helpers
{
    /// <summary>
    /// Open appointments (Pendiente or Confirmada) from the start of today, in the
    /// business time zone, for one employee or one service (B13, decision 7).
    /// Cita.InicioEn holds the business wall-clock time, so "today" is the local
    /// midnight. This is the same window the frontend links to ("Citas desde hoy").
    /// </summary>
    public static class CitasFuturasHelper
    {
        public static async Task<int> ContarAsync(
            ApplicationDbContext db, Guid negocioId, Guid? empleadoId = null, Guid? servicioId = null)
        {
            var zona = await db.Negocios.AsNoTracking()
                .Where(n => n.Id == negocioId)
                .Select(n => n.ZonaHoraria)
                .FirstOrDefaultAsync();
            var tz = ZonaHorariaHelper.Resolver(zona);
            var inicioHoy = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz).Date;

            var query = db.Citas.Where(c =>
                c.NegocioId == negocioId &&
                (c.Estado == EstadosCitas.Pendiente || c.Estado == EstadosCitas.Confirmada) &&
                c.InicioEn >= inicioHoy);
            if (empleadoId.HasValue) query = query.Where(c => c.EmpleadoId == empleadoId.Value);
            if (servicioId.HasValue) query = query.Where(c => c.ServicioId == servicioId.Value);
            return await query.CountAsync();
        }
    }
}
