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
        private readonly ConcurrentDictionary<Guid, Registro> _registros = new();

        /// <summary>Per-negocio state; every read and write happens under a lock on the instance.</summary>
        private sealed class Registro
        {
            public readonly List<DateTimeOffset> Intentos = new();
            /// <summary>Until when the current block has already been reported (audited).</summary>
            public DateTimeOffset AvisadoHasta = DateTimeOffset.MinValue;
        }

        public KioscoSalidaLimitador(TimeProvider reloj) => _reloj = reloj;

        public bool Intentar(Guid negocioId, IReadOnlyCollection<DateTimeOffset> fallosPersistidos, out TimeSpan reintentarEn)
        {
            var ahora = _reloj.GetUtcNow();
            var registro = _registros.GetOrAdd(negocioId, _ => new Registro());
            lock (registro)
            {
                var log = registro.Intentos;
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
            if (!_registros.TryGetValue(negocioId, out var registro)) return MaxIntentos;

            var ahora = _reloj.GetUtcNow();
            lock (registro)
            {
                var log = registro.Intentos;
                Podar(log, ahora);
                var restantes = Math.Max(0, MaxIntentos - log.Count);
                if (restantes == 0) reintentarEn = Espera(log, ahora);
                return restantes;
            }
        }

        public void Reembolsar(Guid negocioId)
        {
            if (!_registros.TryGetValue(negocioId, out var registro)) return;
            lock (registro)
            {
                var log = registro.Intentos;
                Podar(log, _reloj.GetUtcNow());
                // The log is sorted, so the newest entry is the last one. Under concurrency it may
                // belong to another request, but only the count matters: exactly one attempt is
                // returned, the one this request took. A persisted failure dropped here comes back
                // on the next reseed, so a refund never erases a recorded wrong guess.
                if (log.Count > 0) log.RemoveAt(log.Count - 1);
            }
        }

        public bool AvisarBloqueo(Guid negocioId, TimeSpan reintentarEn)
        {
            var ahora = _reloj.GetUtcNow();
            var registro = _registros.GetOrAdd(negocioId, _ => new Registro());
            lock (registro)
            {
                if (registro.AvisadoHasta > ahora) return false;
                registro.AvisadoHasta = ahora + (reintentarEn > TimeSpan.Zero ? reintentarEn : TimeSpan.FromSeconds(1));
                return true;
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
