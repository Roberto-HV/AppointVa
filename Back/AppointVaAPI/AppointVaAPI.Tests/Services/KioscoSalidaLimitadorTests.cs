using AppointVaAPI.Services;
using FluentAssertions;

namespace AppointVaAPI.Tests.Services;

public class KioscoSalidaLimitadorTests
{
    private sealed class RelojManual : TimeProvider
    {
        public DateTimeOffset Ahora { get; set; } = new(2026, 10, 22, 12, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => Ahora;
    }

    private static readonly DateTimeOffset[] SinPersistidos = [];
    private readonly RelojManual _reloj = new();
    private readonly Guid _negocio = Guid.NewGuid();
    private KioscoSalidaLimitador Crear() => new(_reloj);

    [Fact]
    public void Permite3IntentosYBloqueaElCuarto()
    {
        var limitador = Crear();

        for (var i = 0; i < 3; i++)
            limitador.Intentar(_negocio, SinPersistidos, out _).Should().BeTrue($"attempt {i + 1} is within the limit");

        limitador.Intentar(_negocio, SinPersistidos, out var espera).Should().BeFalse();
        espera.Should().Be(TimeSpan.FromMinutes(5));
        limitador.Restantes(_negocio, out _).Should().Be(0);
    }

    [Fact]
    public void LaEsperaEsLaRealDesdeElPrimerIntentoQueAunCuenta()
    {
        var limitador = Crear();
        limitador.Intentar(_negocio, SinPersistidos, out _);
        _reloj.Ahora += TimeSpan.FromMinutes(1);
        limitador.Intentar(_negocio, SinPersistidos, out _);
        _reloj.Ahora += TimeSpan.FromMinutes(1);
        limitador.Intentar(_negocio, SinPersistidos, out _);

        // 2 minutes after the first attempt: 3 minutes remain, not a whole window.
        limitador.Restantes(_negocio, out var esperaTrasFallo).Should().Be(0);
        esperaTrasFallo.Should().Be(TimeSpan.FromMinutes(3));

        _reloj.Ahora += TimeSpan.FromSeconds(90);
        limitador.Intentar(_negocio, SinPersistidos, out var espera).Should().BeFalse();
        espera.Should().Be(TimeSpan.FromSeconds(90));
    }

    [Fact]
    public void VentanaDeslizante_LiberaUnIntentoCuandoSaleElMasAntiguo()
    {
        var limitador = Crear();
        limitador.Intentar(_negocio, SinPersistidos, out _);
        _reloj.Ahora += TimeSpan.FromMinutes(2);
        limitador.Intentar(_negocio, SinPersistidos, out _);
        limitador.Intentar(_negocio, SinPersistidos, out _);

        _reloj.Ahora += TimeSpan.FromMinutes(3); // the first attempt leaves the window
        limitador.Restantes(_negocio, out _).Should().Be(1);
        limitador.Intentar(_negocio, SinPersistidos, out _).Should().BeTrue();
        limitador.Intentar(_negocio, SinPersistidos, out var espera).Should().BeFalse();
        espera.Should().Be(TimeSpan.FromMinutes(2), "the next one frees up when the 2-minute attempts expire");
    }

    [Fact]
    public void ElLimiteEsPorNegocio()
    {
        var limitador = Crear();
        for (var i = 0; i < 3; i++) limitador.Intentar(_negocio, SinPersistidos, out _);

        limitador.Intentar(Guid.NewGuid(), SinPersistidos, out _).Should().BeTrue();
        limitador.Restantes(Guid.NewGuid(), out _).Should().Be(3);
    }

    [Fact]
    public void FallosPersistidos_UnReinicioNoDevuelveElPresupuesto()
    {
        // A fresh instance (restart, or another server) sees the failures already recorded.
        var limitador = Crear();
        var persistidos = new[] { _reloj.Ahora.AddMinutes(-4), _reloj.Ahora.AddMinutes(-1) };

        limitador.Intentar(_negocio, persistidos, out _).Should().BeTrue("only 2 of 3 attempts were spent");
        limitador.Restantes(_negocio, out var espera).Should().Be(0);
        espera.Should().Be(TimeSpan.FromMinutes(1), "the -4 min failure leaves the window in 1 minute");

        var tercero = new[] { persistidos[0], persistidos[1], _reloj.Ahora };
        limitador.Intentar(_negocio, tercero, out var esperaBloqueo).Should().BeFalse();
        esperaBloqueo.Should().Be(TimeSpan.FromMinutes(1));
    }

    [Fact]
    public void FallosPersistidos_TresRecientesBloqueanDeEntrada()
    {
        var limitador = Crear();
        var persistidos = new[] { _reloj.Ahora.AddMinutes(-3), _reloj.Ahora.AddMinutes(-2), _reloj.Ahora.AddMinutes(-1) };

        limitador.Intentar(_negocio, persistidos, out var espera).Should().BeFalse();
        espera.Should().Be(TimeSpan.FromMinutes(2));
    }

    [Fact]
    public void FallosPersistidos_IgnoraLosViejosYNoDuplicaLosPropios()
    {
        var limitador = Crear();
        limitador.Intentar(_negocio, SinPersistidos, out _).Should().BeTrue();
        // Same instance: its own failure is now persisted too, plus an expired one.
        var persistidos = new[] { _reloj.Ahora.AddMinutes(-10), _reloj.Ahora };

        limitador.Intentar(_negocio, persistidos, out _).Should().BeTrue();
        limitador.Restantes(_negocio, out _).Should().Be(1, "the persisted copy of an in-memory attempt is not counted twice");
    }

    [Fact]
    public async Task EnParalelo_NuncaConcedeMasDe3()
    {
        var limitador = Crear();
        var concedidos = 0;

        await Task.WhenAll(Enumerable.Range(0, 50).Select(i => Task.Run(() =>
        {
            if (limitador.Intentar(_negocio, SinPersistidos, out _)) Interlocked.Increment(ref concedidos);
        })));

        concedidos.Should().Be(3);
    }

    // ── Refund on a correct password ──────────────────────────────────────────

    [Fact]
    public void Reembolsar_DevuelveElIntentoDeUnaSalidaCorrecta()
    {
        var limitador = Crear();
        limitador.Intentar(_negocio, SinPersistidos, out _); // wrong guess
        limitador.Intentar(_negocio, SinPersistidos, out _); // right password
        limitador.Reembolsar(_negocio);

        limitador.Restantes(_negocio, out _).Should().Be(2, "only the wrong guess still counts");
    }

    [Fact]
    public void Reembolsar_SalidasCorrectasRepetidas_NoAgotanElPresupuesto()
    {
        var limitador = Crear();
        for (var i = 0; i < 10; i++)
        {
            limitador.Intentar(_negocio, SinPersistidos, out _).Should().BeTrue($"exit {i + 1} was correct");
            limitador.Reembolsar(_negocio);
        }

        limitador.Restantes(_negocio, out _).Should().Be(3);
    }

    [Fact]
    public void Reembolsar_SinIntentos_NoDaPresupuestoExtra()
    {
        var limitador = Crear();
        limitador.Reembolsar(_negocio);
        limitador.Intentar(_negocio, SinPersistidos, out _);
        limitador.Reembolsar(_negocio);
        limitador.Reembolsar(_negocio);

        limitador.Restantes(_negocio, out _).Should().Be(3);
        for (var i = 0; i < 3; i++) limitador.Intentar(_negocio, SinPersistidos, out _).Should().BeTrue();
        limitador.Intentar(_negocio, SinPersistidos, out _).Should().BeFalse("a refund never exceeds the limit");
    }

    [Fact]
    public void Reembolsar_NoBorraFallosPersistidos()
    {
        var limitador = Crear();
        var persistidos = new[] { _reloj.Ahora.AddMinutes(-2), _reloj.Ahora.AddMinutes(-1) };
        limitador.Intentar(_negocio, persistidos, out _).Should().BeTrue();
        limitador.Reembolsar(_negocio);
        limitador.Reembolsar(_negocio); // over-refund drops a persisted failure from memory…

        // …but the next attempt reseeds from durable storage.
        limitador.Intentar(_negocio, persistidos, out _).Should().BeTrue();
        limitador.Intentar(_negocio, persistidos, out _).Should().BeFalse();
    }

    [Fact]
    public async Task Reembolsar_EnParalelo_NuncaConcedeMasDelLimite()
    {
        var limitador = Crear();
        limitador.Intentar(_negocio, SinPersistidos, out _); // a correct exit in flight
        var concedidos = 0;

        await Task.WhenAll(Enumerable.Range(0, 50).Select(i => Task.Run(() =>
        {
            if (i == 0) limitador.Reembolsar(_negocio);
            else if (limitador.Intentar(_negocio, SinPersistidos, out _)) Interlocked.Increment(ref concedidos);
        })));

        concedidos.Should().BeLessThanOrEqualTo(3);
        limitador.Restantes(_negocio, out _).Should().Be(0);
    }

    // ── Block reported once ───────────────────────────────────────────────────

    [Fact]
    public void AvisarBloqueo_SoloLaPrimeraVezPorBloqueo()
    {
        var limitador = Crear();
        limitador.AvisarBloqueo(_negocio, TimeSpan.FromMinutes(2)).Should().BeTrue();
        limitador.AvisarBloqueo(_negocio, TimeSpan.FromMinutes(2)).Should().BeFalse();

        _reloj.Ahora = _reloj.Ahora.AddMinutes(1);
        limitador.AvisarBloqueo(_negocio, TimeSpan.FromMinutes(1)).Should().BeFalse("the same block is still running");

        _reloj.Ahora = _reloj.Ahora.AddMinutes(1);
        limitador.AvisarBloqueo(_negocio, TimeSpan.FromMinutes(5)).Should().BeTrue("a new block is reported again");
        limitador.AvisarBloqueo(Guid.NewGuid(), TimeSpan.FromMinutes(5)).Should().BeTrue("blocks are per negocio");
    }
}
