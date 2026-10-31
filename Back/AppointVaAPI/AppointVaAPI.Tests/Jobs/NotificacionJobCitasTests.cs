using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Jobs;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Citas;
using AppointVaAPI.Services.IServices;
using AppointVaAPI.Tests.Controllers;
using FluentAssertions;
using Hangfire;
using Microsoft.Extensions.Configuration;
using NSubstitute;

namespace AppointVaAPI.Tests.Jobs;

public class NotificacionJobCitasTests
{
    private static (
        ApplicationDbContext db,
        NotificacionJob job,
        INotificacionService notificacion,
        IBackgroundJobClient jobClient)
        CrearComponentes(string dbNombre, string backendUrl = "http://localhost:5048")
    {
        var db           = DbContextFactory.Create(dbNombre);
        var notificacion = Substitute.For<INotificacionService>();
        var jobClient    = Substitute.For<IBackgroundJobClient>();
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["FrontendUrl"] = "http://localhost:5173",
                ["BackendUrl"]  = backendUrl,
            })
            .Build();
        var emailService = Substitute.For<IEmailService>();
        return (db, new NotificacionJob(db, notificacion, config, jobClient, emailService), notificacion, jobClient);
    }

    private static async Task<Cita> SeedCitaAsync(ApplicationDbContext db)
    {
        var negocioId  = Guid.NewGuid();
        var servicioId = Guid.NewGuid();
        var empleadoId = Guid.NewGuid();
        var clienteId  = Guid.NewGuid();

        db.Negocios.Add(new Negocio
        {
            Id                 = negocioId,
            Slug               = $"job-test-{negocioId.ToString("N")[..8]}",
            Nombre             = "Negocio Job",
            ZonaHoraria        = "UTC",
            Activo             = 1,
            FechaCreacion      = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        });
        db.Servicios.Add(new Servicio
        {
            Id                 = servicioId,
            NegocioId          = negocioId,
            Nombre             = "Corte",
            DuracionMinutos    = 30,
            BufferMinutos      = 0,
            Precio             = 200m,
            Orden              = 1,
            Activo             = 1,
            FechaCreacion      = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        });
        db.Empleados.Add(new Empleado
        {
            Id                 = empleadoId,
            NegocioId          = negocioId,
            Nombre             = "Ana",
            Activo             = 1,
            FechaCreacion      = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        });
        db.Clientes.Add(new Cliente
        {
            Id                    = clienteId,
            NegocioId             = negocioId,
            NombreCompleto        = "Cliente Test",
            Telefono              = "5500000001",
            Email                 = "cliente@test.com",
            TotalCitas            = 0,
            CantidadInasistencias = 0,
            FechaCreacion         = DateTime.UtcNow,
            FechaActualizacion    = DateTime.UtcNow,
        });

        var cita = new Cita
        {
            Id                 = Guid.NewGuid(),
            CodigoConfirmacion = Guid.NewGuid().ToString("N")[..8].ToUpper(),
            NegocioId          = negocioId,
            ClienteId          = clienteId,
            EmpleadoId         = empleadoId,
            ServicioId         = servicioId,
            Estado             = EstadosCitas.Confirmada,
            Precio             = 200m,
            InicioEn           = DateTime.UtcNow.AddDays(1),
            FinEn              = DateTime.UtcNow.AddDays(1).AddMinutes(30),
            FechaCreacion      = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        };
        db.Citas.Add(cita);
        await db.SaveChangesAsync();
        return cita;
    }

    // ── EnviarConfirmacion ─────────────────────────────────────────────────────

    [Fact]
    public async Task EnviarConfirmacion_CitaExistente_LlamaNotificacion()
    {
        var (db, job, notificacion, _) = CrearComponentes(
            nameof(EnviarConfirmacion_CitaExistente_LlamaNotificacion));
        var cita = await SeedCitaAsync(db);

        await job.EnviarConfirmacionAsync(cita.Id, "e@t.com", "Nombre");

        await notificacion.Received(1).EnviarConfirmacionCitaAsync(
            Arg.Any<Cita>(), Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<string?>());
    }

    [Fact]
    public async Task EnviarConfirmacion_BackendUrlConApiYBarraFinal_EnlaceIcalSinDuplicarApi()
    {
        var (db, job, notificacion, _) = CrearComponentes(
            nameof(EnviarConfirmacion_BackendUrlConApiYBarraFinal_EnlaceIcalSinDuplicarApi),
            backendUrl: "https://api.appointva.com/api/");
        var cita = await SeedCitaAsync(db);

        await job.EnviarConfirmacionAsync(cita.Id, "e@t.com", "Nombre");

        await notificacion.Received(1).EnviarConfirmacionCitaAsync(
            Arg.Any<Cita>(), Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<string?>(),
            $"https://api.appointva.com/api/publico/citas/{cita.CodigoConfirmacion}/ical",
            Arg.Any<string?>(), Arg.Any<string?>());
    }

    [Fact]
    public async Task EnviarConfirmacion_CitaNoExiste_NoLlamaNotificacion()
    {
        var (_, job, notificacion, _) = CrearComponentes(
            nameof(EnviarConfirmacion_CitaNoExiste_NoLlamaNotificacion));

        await job.EnviarConfirmacionAsync(Guid.NewGuid(), "e@t.com", "Nombre");

        await notificacion.DidNotReceive().EnviarConfirmacionCitaAsync(
            Arg.Any<Cita>(), Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<string?>());
    }

    // ── EnviarCancelacion ──────────────────────────────────────────────────────

    [Fact]
    public async Task EnviarCancelacion_CitaExistente_LlamaNotificacion()
    {
        var (db, job, notificacion, _) = CrearComponentes(
            nameof(EnviarCancelacion_CitaExistente_LlamaNotificacion));
        var cita = await SeedCitaAsync(db);

        await job.EnviarCancelacionAsync(cita.Id, "e@t.com", "Nombre");

        await notificacion.Received(1).EnviarCancelacionCitaAsync(
            Arg.Any<Cita>(), Arg.Any<string>(), Arg.Any<string>());
    }

    [Fact]
    public async Task EnviarCancelacion_CitaNoExiste_NoLlamaNotificacion()
    {
        var (_, job, notificacion, _) = CrearComponentes(
            nameof(EnviarCancelacion_CitaNoExiste_NoLlamaNotificacion));

        await job.EnviarCancelacionAsync(Guid.NewGuid(), "e@t.com", "Nombre");

        await notificacion.DidNotReceive().EnviarCancelacionCitaAsync(
            Arg.Any<Cita>(), Arg.Any<string>(), Arg.Any<string>());
    }

    // ── EnviarReagenda ─────────────────────────────────────────────────────────

    [Fact]
    public async Task EnviarReagenda_CitaExistente_LlamaNotificacion()
    {
        var (db, job, notificacion, _) = CrearComponentes(
            nameof(EnviarReagenda_CitaExistente_LlamaNotificacion));
        var cita = await SeedCitaAsync(db);

        await job.EnviarReagendaAsync(cita.Id, "e@t.com", "Nombre", DateTime.UtcNow.AddDays(-1));

        await notificacion.Received(1).EnviarReagendarCitaAsync(
            Arg.Any<Cita>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<DateTime>());
    }

    [Fact]
    public async Task EnviarReagenda_CitaNoExiste_NoLlamaNotificacion()
    {
        var (_, job, notificacion, _) = CrearComponentes(
            nameof(EnviarReagenda_CitaNoExiste_NoLlamaNotificacion));

        await job.EnviarReagendaAsync(Guid.NewGuid(), "e@t.com", "Nombre", DateTime.UtcNow.AddDays(-1));

        await notificacion.DidNotReceive().EnviarReagendarCitaAsync(
            Arg.Any<Cita>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<DateTime>());
    }

    // ── EnviarSolicitudResena ──────────────────────────────────────────────────

    [Fact]
    public async Task EnviarSolicitudResena_CitaExistente_LlamaNotificacion()
    {
        var (db, job, notificacion, _) = CrearComponentes(
            nameof(EnviarSolicitudResena_CitaExistente_LlamaNotificacion));
        var cita = await SeedCitaAsync(db);

        await job.EnviarSolicitudResenaAsync(cita.Id, "e@t.com", "Nombre", "http://url/resena");

        await notificacion.Received(1).EnviarSolicitudResenaAsync(
            Arg.Any<Cita>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>());
    }

    [Fact]
    public async Task EnviarSolicitudResena_CitaNoExiste_NoLlamaNotificacion()
    {
        var (_, job, notificacion, _) = CrearComponentes(
            nameof(EnviarSolicitudResena_CitaNoExiste_NoLlamaNotificacion));

        await job.EnviarSolicitudResenaAsync(Guid.NewGuid(), "e@t.com", "Nombre", "http://url/resena");

        await notificacion.DidNotReceive().EnviarSolicitudResenaAsync(
            Arg.Any<Cita>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>());
    }

    // ── Client deleted after the job was enqueued (G3) ─────────────────────────
    // A deleted client is deliberately not messaged, even with the email captured at
    // enqueue time, and the job returns normally (no exception, so no Hangfire retry).

    private static async Task<Cita> SeedCitaDeClienteEliminadoAsync(ApplicationDbContext db)
    {
        var cita = await SeedCitaAsync(db);
        var cliente = await db.Clientes.FindAsync(cita.ClienteId);
        cliente!.FechaEliminacion = DateTime.UtcNow;
        await db.SaveChangesAsync();
        // A fresh job runs on a fresh context: nothing of the seed stays tracked.
        db.ChangeTracker.Clear();
        return cita;
    }

    [Fact]
    public async Task ClienteEliminado_NingunMensajeAlCliente_YElJobTerminaSinError()
    {
        var (db, job, notificacion, _) = CrearComponentes(
            nameof(ClienteEliminado_NingunMensajeAlCliente_YElJobTerminaSinError));
        var cita = await SeedCitaDeClienteEliminadoAsync(db);

        var enviar = async () =>
        {
            await job.EnviarConfirmacionAsync(cita.Id, "cliente@test.com", "Cliente Test");
            await job.EnviarCancelacionAsync(cita.Id, "cliente@test.com", "Cliente Test");
            await job.EnviarReagendaAsync(cita.Id, "cliente@test.com", "Cliente Test", DateTime.UtcNow);
            await job.EnviarSolicitudResenaAsync(cita.Id, "cliente@test.com", "Cliente Test", "http://url/resena");
        };

        await enviar.Should().NotThrowAsync();
        notificacion.ReceivedCalls().Should().BeEmpty();
    }

    [Fact]
    public async Task ClienteEliminado_EnviarTicket_NoEnviaCorreo()
    {
        var db           = DbContextFactory.Create(nameof(ClienteEliminado_EnviarTicket_NoEnviaCorreo));
        var emailService = Substitute.For<IEmailService>();
        var job = new NotificacionJob(db, Substitute.For<INotificacionService>(),
            new ConfigurationBuilder().Build(), Substitute.For<IBackgroundJobClient>(), emailService);
        var cita = await SeedCitaDeClienteEliminadoAsync(db);

        await job.EnviarTicketAsync(cita.Id);

        emailService.ReceivedCalls().Should().BeEmpty();
    }

    [Fact]
    public async Task ClienteVivo_EnviarTicket_SiEnviaCorreo()
    {
        var db           = DbContextFactory.Create(nameof(ClienteVivo_EnviarTicket_SiEnviaCorreo));
        var emailService = Substitute.For<IEmailService>();
        var job = new NotificacionJob(db, Substitute.For<INotificacionService>(),
            new ConfigurationBuilder().Build(), Substitute.For<IBackgroundJobClient>(), emailService);
        var cita = await SeedCitaAsync(db);
        db.ChangeTracker.Clear();

        await job.EnviarTicketAsync(cita.Id);

        emailService.ReceivedCalls().Should().ContainSingle();
    }

    [Fact]
    public async Task EnviarTicket_PasaNegocioAnticipoPagoDivididoYEnlaceDeReservas()
    {
        var db           = DbContextFactory.Create(nameof(EnviarTicket_PasaNegocioAnticipoPagoDivididoYEnlaceDeReservas));
        var emailService = Substitute.For<IEmailService>();
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["FrontendUrl"] = "https://appointva.com" })
            .Build();
        var job = new NotificacionJob(db, Substitute.For<INotificacionService>(),
            config, Substitute.For<IBackgroundJobClient>(), emailService);
        var cita = await SeedCitaAsync(db);

        var negocio = await db.Negocios.FindAsync(cita.NegocioId);
        negocio!.LogoUrl   = "https://cdn.example.com/logo.png";
        negocio.Direccion  = "Av. Juárez 120";
        negocio.Telefono   = "5512345678";
        negocio.Sector     = "salud";
        var registrada = await db.Citas.FindAsync(cita.Id);
        registrada!.Precio           = 180m; // coupon applied at booking (list price: 200)
        registrada.AnticipoRecibido  = true;
        registrada.MontoAnticipo     = 50m;
        registrada.Pagada            = true;
        registrada.MetodoPago        = "Tarjeta";
        registrada.MetodoPago2       = "Efectivo";
        registrada.MontoPago2        = 30m;
        registrada.MontoRecibido     = 50m;
        registrada.Cambio            = 20m;
        registrada.Propina           = 15m;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        TicketCitaDatos? datos = null;
        await emailService.EnviarTicketCitaAsync("cliente@test.com",
            Arg.Do<TicketCitaDatos>(d => datos = d));

        await job.EnviarTicketAsync(cita.Id);

        datos.Should().NotBeNull();
        datos!.NegocioLogoUrl.Should().Be("https://cdn.example.com/logo.png");
        datos.NegocioDireccion.Should().Be("Av. Juárez 120");
        datos.NegocioTelefono.Should().Be("5512345678");
        datos.Sector.Should().Be("salud");
        datos.Folio.Should().Be(cita.CodigoConfirmacion);
        datos.EmpleadoNombre.Should().Be("Ana");
        datos.DuracionMinutos.Should().Be(30);
        datos.Precio.Should().Be(180m);
        datos.PrecioServicio.Should().Be(200m);
        datos.Anticipo.Should().Be(50m);
        datos.MontoCobrado.Should().Be(130m, "without a stored charge it is what was left after the advance");
        datos.MetodoPago2.Should().Be("Efectivo");
        datos.MontoPago2.Should().Be(30m);
        datos.MontoRecibido.Should().Be(50m);
        datos.Cambio.Should().Be(20m);
        datos.Propina.Should().Be(15m);
        datos.UrlReserva.Should().Be($"https://appointva.com/b/{negocio.Slug}");
    }
}
