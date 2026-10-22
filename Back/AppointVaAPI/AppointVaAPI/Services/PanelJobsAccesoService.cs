using System.Collections.Concurrent;
using System.Security.Cryptography;
using AppointVaAPI.Services.IServices;

namespace AppointVaAPI.Services
{
    /// <summary>
    /// In-memory, singleton implementation of <see cref="IPanelJobsAccesoService"/>.
    /// ConcurrentDictionary.TryRemove makes the ticket exchange atomic, so two concurrent
    /// requests with the same ticket can never both succeed.
    /// Its name omits "Hangfire" because the integration test factory strips every registration whose type name contains it.
    /// </summary>
    public class PanelJobsAccesoService : IPanelJobsAccesoService
    {
        private sealed record Sesion(Guid UsuarioId, DateTimeOffset Expira, DateTimeOffset VerificadaHasta);

        private readonly TimeProvider _reloj;
        private readonly ConcurrentDictionary<string, (Guid UsuarioId, DateTimeOffset Expira)> _tickets = new();
        private readonly ConcurrentDictionary<string, Sesion> _sesiones = new();

        public TimeSpan DuracionTicket { get; } = TimeSpan.FromSeconds(60);
        public TimeSpan DuracionSesion { get; } = TimeSpan.FromMinutes(60);
        public TimeSpan IntervaloReverificacion { get; } = TimeSpan.FromSeconds(60);

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
            var ahora = _reloj.GetUtcNow();
            if (entrada.Expira <= ahora) return null;

            Purgar();
            var sesion = GenerarValorAleatorio();
            // VerificadaHasta = now: the first dashboard request re-checks the user.
            _sesiones[sesion] = new Sesion(entrada.UsuarioId, ahora + DuracionSesion, ahora);
            return sesion;
        }

        public async Task<bool> SesionValidaAsync(string? sesionId, Func<Guid, Task<bool>> usuarioAutorizado)
        {
            if (string.IsNullOrWhiteSpace(sesionId)) return false;
            if (!_sesiones.TryGetValue(sesionId, out var entrada)) return false;

            var ahora = _reloj.GetUtcNow();
            if (entrada.Expira <= ahora)
            {
                _sesiones.TryRemove(sesionId, out _);
                return false;
            }

            if (entrada.VerificadaHasta > ahora) return true;

            if (!await usuarioAutorizado(entrada.UsuarioId))
            {
                RevocarSesionesDeUsuario(entrada.UsuarioId);
                return false;
            }

            // If a concurrent revoke removed the entry, TryUpdate fails and the next request is rejected.
            _sesiones.TryUpdate(sesionId, entrada with { VerificadaHasta = ahora + IntervaloReverificacion }, entrada);
            return true;
        }

        public void RevocarSesionesDeUsuario(Guid usuarioId)
        {
            foreach (var (clave, valor) in _tickets)
                if (valor.UsuarioId == usuarioId) _tickets.TryRemove(clave, out _);
            foreach (var (clave, valor) in _sesiones)
                if (valor.UsuarioId == usuarioId) _sesiones.TryRemove(clave, out _);
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
