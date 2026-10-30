using AppointVaAPI.Data;
using AppointVaAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Helpers
{
    /// <summary>
    /// Resolves the client of each appointment without going through the Cita.Cliente
    /// navigation in the query (G3).
    ///
    /// Cita.Cliente is a required navigation and Cliente has a soft-delete query filter
    /// (FechaEliminacion == null), so Include(c => c.Cliente), a projection through
    /// c.Cliente or a Where on it all become an INNER JOIN that silently drops every
    /// appointment of a deleted client. Load the appointments first, then the clients
    /// apart through the same filter: the appointment always survives, and a deleted
    /// client is simply missing (Cita.Cliente stays null), so their contact data is
    /// never served again. Same rule as ReportesController.ObtenerCitasDelRangoAsync.
    /// </summary>
    public static class ClientesDeCitasHelper
    {
        /// <summary>Name shown in the panel for an appointment whose client was deleted.</summary>
        public const string ClienteEliminado = "Cliente eliminado";

        /// <summary>The client's name, or <see cref="ClienteEliminado"/> when it was deleted.</summary>
        public static string Nombre(Cliente? cliente) => cliente?.NombreCompleto ?? ClienteEliminado;

        // Live clients of one business; the Cliente query filter leaves the deleted out.
        private static IQueryable<Cliente> Vivos(ApplicationDbContext db, Guid negocioId, IEnumerable<Guid> clienteIds)
        {
            var ids = clienteIds.Distinct().ToList();
            return db.Clientes.Where(cl => cl.NegocioId == negocioId && ids.Contains(cl.Id));
        }

        /// <summary>
        /// Read-only map of the live (not deleted) clients of a business by id, untracked.
        /// A deleted client is not in the map.
        /// </summary>
        public static Task<Dictionary<Guid, Cliente>> CargarAsync(
            ApplicationDbContext db, Guid negocioId, IEnumerable<Guid> clienteIds) =>
            Vivos(db, negocioId, clienteIds).AsNoTracking().ToDictionaryAsync(cl => cl.Id);

        /// <summary>
        /// Sets Cita.Cliente on every appointment whose client still exists, scoped to the
        /// appointment's own business. A deleted client leaves Cita.Cliente null; it is
        /// never assigned null explicitly, so a tracked appointment is not modified.
        /// Clients are loaded with tracking, whatever the appointments are: an untracked client
        /// hung on a tracked appointment would be inserted again on SaveChanges.
        /// </summary>
        public static async Task AdjuntarAsync(ApplicationDbContext db, IReadOnlyCollection<Cita> citas)
        {
            foreach (var grupo in citas.GroupBy(c => c.NegocioId))
            {
                var clientes = await Vivos(db, grupo.Key, grupo.Select(c => c.ClienteId))
                    .ToDictionaryAsync(cl => cl.Id);
                foreach (var cita in grupo)
                    if (clientes.TryGetValue(cita.ClienteId, out var cliente))
                        cita.Cliente = cliente;
            }
        }

        /// <summary>Single-appointment overload of <see cref="AdjuntarAsync(ApplicationDbContext, IReadOnlyCollection{Cita})"/>; null-safe.</summary>
        public static async Task<Cita?> AdjuntarAsync(ApplicationDbContext db, Cita? cita)
        {
            if (cita is not null) await AdjuntarAsync(db, new[] { cita });
            return cita;
        }
    }
}
