using System.Collections.Concurrent;
using System.Security.Cryptography;
using AppointVaAPI.Services.IServices;

namespace AppointVaAPI.Services
{
    /// <summary>
    /// In-memory, singleton implementation of <see cref="IPanelJobsAccesoService"/>.
    /// ConcurrentDictionary.TryRemove makes the ticket exchange atomic, so two concurrent
    /// requests with the same ticket can never both succeed.
    /// </summary>
    public class PanelJobsAccesoService : IPanelJobsAccesoService
    {
        private readonly TimeProvider _reloj;
        private readonly ConcurrentDictionary<string, (Guid UsuarioId, DateTimeOffset Expira)> _tickets = new();
        private readonly ConcurrentDictionary<string, (Guid UsuarioId, DateTimeOffset Expira)> _sesiones = new();

        public TimeSpan DuracionTicket { get; } = TimeSpan.FromSeconds(60);
        public TimeSpan DuracionSesion { get; } = TimeSpan.FromMinutes(60);

        public PanelJobsAccesoService(TimeProvider reloj)
        {
            _reloj = reloj;
        }

        public string EmitirTicket(Guid usuarioId)
        {
            Purgar();
            var ticket = GenerarValorAleatorio();
            _tickets[ticket] = (usuarioId, _reloj.GetUtcNow() + DuracionTicket);
            return ticket;
        }

        public string? CanjearTicket(string? ticket)
        {
            if (string.IsNullOrWhiteSpace(ticket)) return null;
            if (!_tickets.TryRemove(ticket, out var entrada)) return null;
            if (entrada.Expira <= _reloj.GetUtcNow()) return null;

            Purgar();
            var sesion = GenerarValorAleatorio();
            _sesiones[sesion] = (entrada.UsuarioId, _reloj.GetUtcNow() + DuracionSesion);
            return sesion;
        }

        public bool SesionValida(string? sesionId)
        {
            if (string.IsNullOrWhiteSpace(sesionId)) return false;
            if (!_sesiones.TryGetValue(sesionId, out var entrada)) return false;
            if (entrada.Expira > _reloj.GetUtcNow()) return true;

            _sesiones.TryRemove(sesionId, out _);
            return false;
        }

        private void Purgar()
        {
            var ahora = _reloj.GetUtcNow();
            foreach (var (clave, valor) in _tickets)
                if (valor.Expira <= ahora) _tickets.TryRemove(clave, out _);
            foreach (var (clave, valor) in _sesiones)
                if (valor.Expira <= ahora) _sesiones.TryRemove(clave, out _);
        }

        // 256 bits from a CSPRNG, URL-safe base64 (no padding).
        private static string GenerarValorAleatorio() =>
            Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
                .TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
