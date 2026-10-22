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
    public void Canjear_TicketValido_DevuelveSesionValida()
    {
        var svc = Crear();
        var ticket = svc.EmitirTicket(Guid.NewGuid());

        var sesion = svc.CanjearTicket(ticket);

        sesion.Should().NotBeNullOrEmpty();
        sesion.Should().NotBe(ticket);
        svc.SesionValida(sesion).Should().BeTrue();
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
    public void Sesion_Expira()
    {
        var svc = Crear();
        var sesion = svc.CanjearTicket(svc.EmitirTicket(Guid.NewGuid()));

        _reloj.Ahora += svc.DuracionSesion + TimeSpan.FromSeconds(1);

        svc.SesionValida(sesion).Should().BeFalse();
    }

    [Fact]
    public void Sesion_NoSeAceptaComoTicket_NiTicketComoSesion()
    {
        var svc = Crear();
        var ticket = svc.EmitirTicket(Guid.NewGuid());

        svc.SesionValida(ticket).Should().BeFalse();
        var sesion = svc.CanjearTicket(ticket);
        svc.CanjearTicket(sesion).Should().BeNull();
    }
}
