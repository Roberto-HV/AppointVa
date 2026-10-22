using System.Collections.Concurrent;
using AppointVaAPI.Services.IServices;

namespace AppointVaAPI.Services
{
    /// <summary>
    /// Sliding window of <see cref="MaxIntentos"/> attempts per <see cref="Ventana"/> and negocio.
    /// Every attempt is logged with its time, so the wait reported is the real one: the moment the
    /// oldest attempt that still counts leaves the window, not a whole window.
    /// <para>
    /// The in-memory log is the fast, parallel-safe path (an attempt is taken under a lock before
    /// the password is checked). The persisted failures (the "KioscoSalidaFallida" audit rows the
    /// caller passes in) are the durable source: when they outnumber the in-memory log (after a
    /// restart, or when another instance served the earlier guesses) the log is reseeded from them,
    /// so a restart or a second instance does not hand out a fresh budget. Across instances the
    /// limit is best effort: two instances guessing at the same instant can each spend one attempt
    /// before either failure is persisted.
    /// </para>
    /// </summary>
    public sealed class KioscoSalidaLimitador : IKioscoSalidaLimitador
    {
        public const int MaxIntentos = 3;
        public static readonly TimeSpan Ventana = TimeSpan.FromMinutes(5);

        private readonly TimeProvider _reloj;
        private readonly ConcurrentDictionary<Guid, List<DateTimeOffset>> _intentos = new();

        public KioscoSalidaLimitador(TimeProvider reloj) => _reloj = reloj;

        public bool Intentar(Guid negocioId, IReadOnlyCollection<DateTimeOffset> fallosPersistidos, out TimeSpan reintentarEn)
        {
            var ahora = _reloj.GetUtcNow();
            var log = _intentos.GetOrAdd(negocioId, _ => new List<DateTimeOffset>());
            lock (log)
            {
                Podar(log, ahora);

                // A future timestamp (clock skew between instances) counts as "now".
                var persistidos = fallosPersistidos
                    .Select(f => f > ahora ? ahora : f)
                    .Where(f => f > ahora - Ventana)
                    .ToList();
                if (persistidos.Count > log.Count)
                {
                    log.Clear();
                    log.AddRange(persistidos);
                    log.Sort();
                }

                if (log.Count >= MaxIntentos)
                {
                    reintentarEn = Espera(log, ahora);
                    return false;
                }

                log.Add(ahora);
                reintentarEn = TimeSpan.Zero;
                return true;
            }
        }

        public int Restantes(Guid negocioId, out TimeSpan reintentarEn)
        {
            reintentarEn = TimeSpan.Zero;
            if (!_intentos.TryGetValue(negocioId, out var log)) return MaxIntentos;

            var ahora = _reloj.GetUtcNow();
            lock (log)
            {
                Podar(log, ahora);
                var restantes = Math.Max(0, MaxIntentos - log.Count);
                if (restantes == 0) reintentarEn = Espera(log, ahora);
                return restantes;
            }
        }

        private static void Podar(List<DateTimeOffset> log, DateTimeOffset ahora) =>
            log.RemoveAll(t => t <= ahora - Ventana);

        // One attempt frees up when the entry that pushes the count to the limit leaves the window.
        private static TimeSpan Espera(List<DateTimeOffset> log, DateTimeOffset ahora)
        {
            var libera = log[log.Count - MaxIntentos] + Ventana;
            return libera > ahora ? libera - ahora : TimeSpan.Zero;
        }
    }
}
