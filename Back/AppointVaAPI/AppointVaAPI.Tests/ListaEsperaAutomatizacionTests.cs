using AppointVaAPI.Constants;
using AppointVaAPI.Controllers.V1;
using AppointVaAPI.Jobs;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Citas;
using AppointVaAPI.Repository.IRepository;
using AppointVaAPI.Services.IServices;
using AppointVaAPI.Tests.Controllers;
using FluentAssertions;
using Hangfire;
using Hangfire.Common;
using Hangfire.States;
using Microsoft.Extensions.Configuration;
using NSubstitute;

namespace AppointVaAPI.Tests;

public class ListaEsperaAutomatizacionTests
{
    private static readonly Guid NegocioId = Guid.NewGuid();
    private static readonly Guid ServicioId = Guid.NewGuid();

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static (
        CitasController controller,
        ICitaRepository citaRepo,
        IBackgroundJobClient jobClient,
        AppointVaAPI.Data.ApplicationDbContext db)
        CrearComponentesCitas(string dbNombre)
    {
        var db = DbContextFactory.Create(dbNombre);
        var citaRepo = Substitute.For<ICitaRepository>();
        var clienteRepo = Substitute.For<IClienteRepository>();
        var jobClient = Substitute.For<IBackgroundJobClient>();
        var contexto = Substitute.For<IContextoNegocio>();
        contexto.NegocioId.Returns(NegocioId);
        contexto.Rol.Returns("Propietario");
        var config = Substitute.For<IConfiguration>();

        var controller = new CitasController(
            citaRepo,
            clienteRepo,
            Substitute.For<IServicioRepository>(),
            contexto,
            db,
            Substitute.For<INotificacionService>(),
            jobClient,
            config);

        return (controller, citaRepo, jobClient, db);
    }

    private static (
        NotificacionJob job,
        INotificacionService notificacion,
        IBackgroundJobClient jobClient,
        AppointVaAPI.Data.ApplicationDbContext db)
        CrearComponentesJob(string dbNombre)
    {
        var db = DbContextFactory.Create(dbNombre);
        var notificacion = Substitute.For<INotificacionService>();
        var jobClient = Substitute.For<IBackgroundJobClient>();
        var config = Substitute.For<IConfiguration>();
        config["FrontendUrl"].Returns("https://appointva.com");

        var job = new NotificacionJob(db, notificacion, config, jobClient);
        return (job, notificacion, jobClient, db);
    }

    private static Negocio NegocioConListaEsperaActiva(bool activa = true) => new()
    {
        Id = NegocioId,
        Slug = "test-negocio",
        Nombre = "Negocio Test",
        ListaEsperaActiva = activa,
        ZonaHoraria = "Central Standard Time (Mexico)",
        Moneda = "MXN",
        Activo = 1,
        FechaCreacion = DateTime.UtcNow,
        FechaActualizacion = DateTime.UtcNow
    };

    private static Cita CitaCancelable() => new()
    {
        Id = Guid.NewGuid(),
        NegocioId = NegocioId,
        ServicioId = ServicioId,
        CodigoConfirmacion = "TEST0001",
        ClienteId = Guid.NewGuid(),
        EmpleadoId = Guid.NewGuid(),
        InicioEn = DateTime.UtcNow.AddDays(1),
        FinEn = DateTime.UtcNow.AddDays(1).AddHours(1),
        Estado = EstadosCitas.Confirmada,
        Precio = 200m,
        FechaCreacion = DateTime.UtcNow,
        FechaActualizacion = DateTime.UtcNow,
        Cliente = new Cliente
        {
            Id = Guid.NewGuid(),
            NegocioId = NegocioId,
            NombreCompleto = "Juan Pérez",
            Telefono = "5511223344",
            Email = null,
            TotalCitas = 1,
            CantidadInasistencias = 0,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow
        }
    };

    private static ListaEspera EntradaEsperando(Guid? servicioId = null) => new()
    {
        Id = Guid.NewGuid(),
        NegocioId = NegocioId,
        ServicioId = servicioId ?? ServicioId,
        NombreCliente = "Ana López",
        TelefonoCliente = "5599887766",
        EmailCliente = "ana@test.com",
        Estado = "Esperando",
        FechaCreacion = DateTime.UtcNow
    };

    // ── Tests de CitasController ───────────────────────────────────────────────

    [Fact]
    public async Task CambiarEstado_Cancelada_CitaEnMenosDe2Horas_NoDisparaNotificacion()
    {
        var (controller, citaRepo, jobClient, db) = CrearComponentesCitas(
            nameof(CambiarEstado_Cancelada_CitaEnMenosDe2Horas_NoDisparaNotificacion));

        db.Negocios.Add(NegocioConListaEsperaActiva(activa: true));
        db.ListaEspera.Add(EntradaEsperando());
        await db.SaveChangesAsync();

        var cita = CitaCancelable();
        cita.InicioEn = DateTime.UtcNow.AddMinutes(90); // menos de 2 horas
        citaRepo.ObtenerPorIdAsync(cita.Id, NegocioId).Returns(cita);

        await controller.CambiarEstado(cita.Id, new CambiarEstadoCitaDto { NuevoEstado = EstadosCitas.Cancelada });

        jobClient.DidNotReceive().Create(
            Arg.Is<Job>(j => j.Method.Name == nameof(NotificacionJob.NotificarListaEsperaAsync)),
            Arg.Any<IState>());
    }

    [Fact]
    public async Task CambiarEstado_Cancelada_ListaEsperaDesactivada_NoDisparaNotificacion()
    {
        var (controller, citaRepo, jobClient, db) = CrearComponentesCitas(
            nameof(CambiarEstado_Cancelada_ListaEsperaDesactivada_NoDisparaNotificacion));

        db.Negocios.Add(NegocioConListaEsperaActiva(activa: false));
        db.ListaEspera.Add(EntradaEsperando());
        await db.SaveChangesAsync();

        var cita = CitaCancelable();
        citaRepo.ObtenerPorIdAsync(cita.Id, NegocioId).Returns(cita);

        await controller.CambiarEstado(cita.Id, new CambiarEstadoCitaDto { NuevoEstado = EstadosCitas.Cancelada });

        jobClient.DidNotReceive().Create(
            Arg.Is<Job>(j => j.Method.Name == nameof(NotificacionJob.NotificarListaEsperaAsync)),
            Arg.Any<IState>());
    }

    [Fact]
    public async Task CambiarEstado_Cancelada_ListaEsperaActiva_SinEntradas_NoDisparaNotificacion()
    {
        var (controller, citaRepo, jobClient, db) = CrearComponentesCitas(
            nameof(CambiarEstado_Cancelada_ListaEsperaActiva_SinEntradas_NoDisparaNotificacion));

        db.Negocios.Add(NegocioConListaEsperaActiva(activa: true));
        await db.SaveChangesAsync();

        var cita = CitaCancelable();
        citaRepo.ObtenerPorIdAsync(cita.Id, NegocioId).Returns(cita);

        await controller.CambiarEstado(cita.Id, new CambiarEstadoCitaDto { NuevoEstado = EstadosCitas.Cancelada });

        jobClient.DidNotReceive().Create(
            Arg.Is<Job>(j => j.Method.Name == nameof(NotificacionJob.NotificarListaEsperaAsync)),
            Arg.Any<IState>());
    }

    [Fact]
    public async Task CambiarEstado_Cancelada_ListaEsperaActiva_ConEntradaEsperando_DisparaNotificacion()
    {
        var (controller, citaRepo, jobClient, db) = CrearComponentesCitas(
            nameof(CambiarEstado_Cancelada_ListaEsperaActiva_ConEntradaEsperando_DisparaNotificacion));

        db.Negocios.Add(NegocioConListaEsperaActiva(activa: true));
        db.ListaEspera.Add(EntradaEsperando());
        await db.SaveChangesAsync();

        var cita = CitaCancelable();
        citaRepo.ObtenerPorIdAsync(cita.Id, NegocioId).Returns(cita);

        await controller.CambiarEstado(cita.Id, new CambiarEstadoCitaDto { NuevoEstado = EstadosCitas.Cancelada });

        jobClient.Received(1).Create(
            Arg.Is<Job>(j => j.Method.Name == nameof(NotificacionJob.NotificarListaEsperaAsync)),
            Arg.Any<IState>());
    }

    // ── Tests de NotificacionJob ───────────────────────────────────────────────

    [Fact]
    public async Task NotificarListaEspera_ConEntradaEsperando_MarcaNotificadoYEncuelaExpiracion()
    {
        var (job, notificacion, jobClient, db) = CrearComponentesJob(
            nameof(NotificarListaEspera_ConEntradaEsperando_MarcaNotificadoYEncuelaExpiracion));

        var negocio = NegocioConListaEsperaActiva();
        var servicio = new Servicio
        {
            Id = ServicioId,
            NegocioId = NegocioId,
            Nombre = "Corte de cabello",
            DuracionMinutos = 30,
            Precio = 150m,
            Activo = 1,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow
        };
        var entrada = EntradaEsperando();
        db.Negocios.Add(negocio);
        db.Servicios.Add(servicio);
        db.ListaEspera.Add(entrada);
        await db.SaveChangesAsync();

        await job.NotificarListaEsperaAsync(NegocioId, ServicioId);

        await notificacion.Received(1).EnviarNotificacionListaEsperaAsync(
            entrada.EmailCliente!,
            entrada.NombreCliente,
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<string>());

        var entradaActualizada = await db.ListaEspera.FindAsync(entrada.Id);
        entradaActualizada!.Estado.Should().Be("Notificado");
        entradaActualizada.FechaNotificacion.Should().NotBeNull();

        jobClient.Received(1).Create(
            Arg.Is<Job>(j => j.Method.Name == nameof(NotificacionJob.ExpirarYNotificarSiguienteAsync)),
            Arg.Any<ScheduledState>());
    }

    [Fact]
    public async Task NotificarListaEspera_SinEntradas_NoHaceNada()
    {
        var (job, notificacion, jobClient, db) = CrearComponentesJob(
            nameof(NotificarListaEspera_SinEntradas_NoHaceNada));

        await job.NotificarListaEsperaAsync(NegocioId, ServicioId);

        await notificacion.DidNotReceive().EnviarNotificacionListaEsperaAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>());
        jobClient.DidNotReceive().Create(Arg.Any<Job>(), Arg.Any<IState>());
    }

    [Fact]
    public async Task ExpirarYNotificarSiguiente_EntradaNotificada_MarcaExpiradoYNotificaSiguiente()
    {
        var (job, _, jobClient, db) = CrearComponentesJob(
            nameof(ExpirarYNotificarSiguiente_EntradaNotificada_MarcaExpiradoYNotificaSiguiente));

        var entrada = new ListaEspera
        {
            Id = Guid.NewGuid(),
            NegocioId = NegocioId,
            ServicioId = ServicioId,
            NombreCliente = "Carlos Ruiz",
            TelefonoCliente = "5544332211",
            EmailCliente = "carlos@test.com",
            Estado = "Notificado",
            FechaCreacion = DateTime.UtcNow,
            FechaNotificacion = DateTime.UtcNow.AddHours(-2)
        };
        db.ListaEspera.Add(entrada);
        await db.SaveChangesAsync();

        await job.ExpirarYNotificarSiguienteAsync(entrada.Id, NegocioId, ServicioId);

        var entradaActualizada = await db.ListaEspera.FindAsync(entrada.Id);
        entradaActualizada!.Estado.Should().Be("Expirado");

        jobClient.Received(1).Create(
            Arg.Is<Job>(j => j.Method.Name == nameof(NotificacionJob.NotificarListaEsperaAsync)),
            Arg.Any<EnqueuedState>());
    }

    [Fact]
    public async Task ExpirarYNotificarSiguiente_EntradaYaNoEsNotificada_NoHaceNada()
    {
        var (job, _, jobClient, db) = CrearComponentesJob(
            nameof(ExpirarYNotificarSiguiente_EntradaYaNoEsNotificada_NoHaceNada));

        var entrada = new ListaEspera
        {
            Id = Guid.NewGuid(),
            NegocioId = NegocioId,
            ServicioId = ServicioId,
            NombreCliente = "Lucía Torres",
            TelefonoCliente = "5512345678",
            EmailCliente = "lucia@test.com",
            Estado = "Confirmado",
            FechaCreacion = DateTime.UtcNow
        };
        db.ListaEspera.Add(entrada);
        await db.SaveChangesAsync();

        await job.ExpirarYNotificarSiguienteAsync(entrada.Id, NegocioId, ServicioId);

        var entradaActualizada = await db.ListaEspera.FindAsync(entrada.Id);
        entradaActualizada!.Estado.Should().Be("Confirmado");
        jobClient.DidNotReceive().Create(Arg.Any<Job>(), Arg.Any<IState>());
    }

    [Fact]
    public async Task NotificarListaEspera_FiltraCorrectamentePorServicio()
    {
        var (job, notificacion, _, db) = CrearComponentesJob(
            nameof(NotificarListaEspera_FiltraCorrectamentePorServicio));

        var otroServicioId = Guid.NewGuid();

        var negocio = NegocioConListaEsperaActiva();
        var servicioTarget = new Servicio
        {
            Id = ServicioId,
            NegocioId = NegocioId,
            Nombre = "Manicure",
            DuracionMinutos = 45,
            Precio = 200m,
            Activo = 1,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow
        };
        var servicioOtro = new Servicio
        {
            Id = otroServicioId,
            NegocioId = NegocioId,
            Nombre = "Pedicure",
            DuracionMinutos = 60,
            Precio = 250m,
            Activo = 1,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow
        };

        db.Negocios.Add(negocio);
        db.Servicios.Add(servicioTarget);
        db.Servicios.Add(servicioOtro);

        var entradaServicioTarget = EntradaEsperando(servicioId: ServicioId);
        var entradaServicioOtro = EntradaEsperando(servicioId: otroServicioId);
        db.ListaEspera.Add(entradaServicioTarget);
        db.ListaEspera.Add(entradaServicioOtro);
        await db.SaveChangesAsync();

        await job.NotificarListaEsperaAsync(NegocioId, ServicioId);

        await notificacion.Received(1).EnviarNotificacionListaEsperaAsync(
            entradaServicioTarget.EmailCliente!,
            entradaServicioTarget.NombreCliente,
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<string>());
    }
}
