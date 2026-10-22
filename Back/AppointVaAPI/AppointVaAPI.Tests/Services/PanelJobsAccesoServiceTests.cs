using AppointVaAPI.Services;
using FluentAssertions;

namespace AppointVaAPI.Tests.Services;

public class PanelJobsAccesoServiceTests
{
    private sealed class RelojManual : TimeProvider
    {
        public DateTimeOffset Ahora { get; set; } = new(2026, 10, 22, 12, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => Ahora;
    }

    private readonly RelojManual _reloj = new();
    private PanelJobsAccesoService Crear() => new(_reloj);
    private static readonly Func<Guid, Task<bool>> Autorizado = _ => Task.FromResult(true);

    [Fact]
    public void Ticket_EsAleatorio_YNoEsUnJwt()
    {
        var svc = Crear();
        var a = svc.EmitirTicket(Guid.NewGuid());
        var b = svc.EmitirTicket(Guid.NewGuid());

        a.Should().NotBe(b);
        a.Should().NotContain(".");
        a.Length.Should().BeGreaterThanOrEqualTo(43);
    }

    [Fact]
    public async Task Canjear_TicketValido_DevuelveSesionValida()
    {
        var svc = Crear();
        var ticket = svc.EmitirTicket(Guid.NewGuid());

        var sesion = svc.CanjearTicket(ticket);

        sesion.Should().NotBeNullOrEmpty();
        sesion.Should().NotBe(ticket);
        (await svc.SesionValidaAsync(sesion, Autorizado)).Should().BeTrue();
    }

    [Fact]
    public void Canjear_DosVeces_SegundaFalla()
    {
        var svc = Crear();
        var ticket = svc.EmitirTicket(Guid.NewGuid());

        svc.CanjearTicket(ticket).Should().NotBeNull();
        svc.CanjearTicket(ticket).Should().BeNull();
    }

    [Fact]
    public void Canjear_TicketExpirado_FallaYQuedaInvalidado()
    {
        var svc = Crear();
        var ticket = svc.EmitirTicket(Guid.NewGuid());

        _reloj.Ahora += svc.DuracionTicket + TimeSpan.FromSeconds(1);

        svc.CanjearTicket(ticket).Should().BeNull();
        _reloj.Ahora -= TimeSpan.FromMinutes(5);
        svc.CanjearTicket(ticket).Should().BeNull();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("desconocido")]
    public void Canjear_TicketInexistente_Falla(string? ticket)
    {
        Crear().CanjearTicket(ticket).Should().BeNull();
    }

    [Fact]
    public async Task Sesion_Expira()
    {
        var svc = Crear();
        var sesion = svc.CanjearTicket(svc.EmitirTicket(Guid.NewGuid()));

        _reloj.Ahora += svc.DuracionSesion + TimeSpan.FromSeconds(1);

        (await svc.SesionValidaAsync(sesion, Autorizado)).Should().BeFalse();
    }

    [Fact]
    public async Task Sesion_NoSeAceptaComoTicket_NiTicketComoSesion()
    {
        var svc = Crear();
        var ticket = svc.EmitirTicket(Guid.NewGuid());

        (await svc.SesionValidaAsync(ticket, Autorizado)).Should().BeFalse();
        var sesion = svc.CanjearTicket(ticket);
        svc.CanjearTicket(sesion).Should().BeNull();
    }

    [Fact]
    public async Task Sesion_UsuarioYaNoAutorizado_PierdeAccesoYSeRevocanSusSesiones()
    {
        var svc = Crear();
        var usuario = Guid.NewGuid();
        var s1 = svc.CanjearTicket(svc.EmitirTicket(usuario));
        var s2 = svc.CanjearTicket(svc.EmitirTicket(usuario));
        var pendiente = svc.EmitirTicket(usuario);
        var autorizado = true;
        Func<Guid, Task<bool>> verificar = _ => Task.FromResult(autorizado);

        (await svc.SesionValidaAsync(s1, verificar)).Should().BeTrue();

        // Demoted / deactivated / locked out: the next re-check after the cache window fails.
        autorizado = false;
        _reloj.Ahora += svc.IntervaloReverificacion + TimeSpan.FromSeconds(1);

        (await svc.SesionValidaAsync(s1, verificar)).Should().BeFalse();
        autorizado = true;
        (await svc.SesionValidaAsync(s1, verificar)).Should().BeFalse();
        (await svc.SesionValidaAsync(s2, verificar)).Should().BeFalse();
        svc.CanjearTicket(pendiente).Should().BeNull();
    }

    [Fact]
    public async Task Sesion_VerificaAlPrimerUso_YCacheaDentroDelIntervalo()
    {
        var svc = Crear();
        var usuario = Guid.NewGuid();
        var sesion = svc.CanjearTicket(svc.EmitirTicket(usuario));
        var llamadas = 0;
        Func<Guid, Task<bool>> verificar = id =>
        {
            id.Should().Be(usuario);
            llamadas++;
            return Task.FromResult(true);
        };

        (await svc.SesionValidaAsync(sesion, verificar)).Should().BeTrue();
        _reloj.Ahora += svc.IntervaloReverificacion - TimeSpan.FromSeconds(1);
        (await svc.SesionValidaAsync(sesion, verificar)).Should().BeTrue();
        llamadas.Should().Be(1);

        _reloj.Ahora += TimeSpan.FromSeconds(2);
        (await svc.SesionValidaAsync(sesion, verificar)).Should().BeTrue();
        llamadas.Should().Be(2);
    }

    [Fact]
    public async Task RevocarSesionesDeUsuario_SoloAfectaAEseUsuario()
    {
        var svc = Crear();
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var sesionA = svc.CanjearTicket(svc.EmitirTicket(a));
        var sesionB = svc.CanjearTicket(svc.EmitirTicket(b));

        svc.RevocarSesionesDeUsuario(a);

        (await svc.SesionValidaAsync(sesionA, Autorizado)).Should().BeFalse();
        (await svc.SesionValidaAsync(sesionB, Autorizado)).Should().BeTrue();
    }
}
