using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Jobs;
using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;
using AppointVaAPI.Tests.Controllers;
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
        CrearComponentes(string dbNombre)
    {
        var db           = DbContextFactory.Create(dbNombre);
        var notificacion = Substitute.For<INotificacionService>();
        var jobClient    = Substitute.For<IBackgroundJobClient>();
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["FrontendUrl"] = "http://localhost:5173",
                ["BackendUrl"]  = "http://localhost:5048",
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
}
