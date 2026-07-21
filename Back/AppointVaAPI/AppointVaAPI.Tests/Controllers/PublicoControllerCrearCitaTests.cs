using AppointVaAPI.Constants;
using AppointVaAPI.Controllers.V1;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Publico;
using AppointVaAPI.Repository.IRepository;
using AppointVaAPI.Services.IServices;
using FluentAssertions;
using Hangfire;
using Hangfire.Common;
using Hangfire.States;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using NSubstitute;

namespace AppointVaAPI.Tests.Controllers;

/// <summary>
/// Tests de PublicoController.CrearCita (POST /api/publico/citas).
/// Cubre validaciones de negocio, servicio, empleado, solapamiento,
/// AutoConfirmar, y notificaciones por email / push.
/// </summary>
public class PublicoControllerCrearCitaTests
{
    // ── Factory ───────────────────────────────────────────────────────────────

    private static (
        PublicoController controller,
        INegocioRepository negocioRepo,
        ICitaRepository citaRepo,
        IClienteRepository clienteRepo,
        IBackgroundJobClient jobClient,
        INotificacionService notificacion,
        ApplicationDbContext db)
        CrearComponentes(string dbNombre)
    {
        var db = DbContextFactory.Create(dbNombre);
        var negocioRepo = Substitute.For<INegocioRepository>();
        var citaRepo = Substitute.For<ICitaRepository>();
        var clienteRepo = Substitute.For<IClienteRepository>();
        var jobClient = Substitute.For<IBackgroundJobClient>();
        var notificacion = Substitute.For<INotificacionService>();

        var controller = new PublicoController(
            db,
            negocioRepo,
            citaRepo,
            clienteRepo,
            Substitute.For<IDisponibilidadService>(),
            notificacion,
            Substitute.For<IEmailService>(),
            Substitute.For<IConfiguration>(),
            jobClient,
            null!,                              // UserManager — no se usa en CrearCita
            Substitute.For<IBlobStorageService>(),
            Substitute.For<IPushService>());

        return (controller, negocioRepo, citaRepo, clienteRepo, jobClient, notificacion, db);
    }

    // ── Helpers de datos ──────────────────────────────────────────────────────

    private static Negocio NegocioActivo(bool autoConfirmar = false) => new()
    {
        Id = Guid.NewGuid(),
        Slug = "mi-salon",
        Nombre = "Mi Salón",
        Activo = 1,
        AutoConfirmar = autoConfirmar,
        HorasRecordatorio = 24,
        FechaCreacion = DateTime.UtcNow,
        FechaActualizacion = DateTime.UtcNow,
    };

    /// <summary>
    /// Siembra Servicio + Empleado + vínculo EmpleadoServicio en la base InMemory
    /// y devuelve las entidades ya persistidas.
    /// </summary>
    private static async Task<(Servicio servicio, Empleado empleado)> SeedDataAsync(
        ApplicationDbContext db, Guid negocioId)
    {
        var servicio = new Servicio
        {
            Id = Guid.NewGuid(),
            NegocioId = negocioId,
            Nombre = "Corte de Cabello",
            DuracionMinutos = 60,
            BufferMinutos = 0,
            Precio = 150m,
            Orden = 1,
            Activo = 1,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        };

        var empleado = new Empleado
        {
            Id = Guid.NewGuid(),
            NegocioId = negocioId,
            Nombre = "Ana Estilista",
            Activo = 1,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        };

        db.Servicios.Add(servicio);
        db.Empleados.Add(empleado);
        db.EmpleadosServicios.Add(new EmpleadoServicio
        {
            EmpleadoId = empleado.Id,
            ServicioId = servicio.Id,
        });

        await db.SaveChangesAsync();
        return (servicio, empleado);
    }

    private static Cliente ClienteDemo(Guid negocioId, string? email = null) => new()
    {
        Id = Guid.NewGuid(),
        NegocioId = negocioId,
        NombreCompleto = "Luis Cliente",
        Telefono = "5599887766",
        Email = email,
        TotalCitas = 0,
        CantidadInasistencias = 0,
        FechaCreacion = DateTime.UtcNow,
        FechaActualizacion = DateTime.UtcNow,
    };

    private static CrearCitaPublicaDto DtoBase(
        Negocio negocio,
        Servicio servicio,
        Empleado empleado,
        string? email = null) => new()
    {
        NegocioSlug = negocio.Slug,
        ServicioId = servicio.Id,
        EmpleadoId = empleado.Id,
        InicioEn = DateTime.UtcNow.AddDays(3),
        NombreCliente = "Luis Cliente",
        TelefonoCliente = "5599887766",
        EmailCliente = email,
    };

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task RetornaNotFound_CuandoNegocioNoExisteOInactivo()
    {
        var (controller, negocioRepo, _, _, _, _, _) = CrearComponentes(
            nameof(RetornaNotFound_CuandoNegocioNoExisteOInactivo));
        negocioRepo.ObtenerPorSlugAsync(Arg.Any<string>()).Returns((Negocio?)null);

        var dto = new CrearCitaPublicaDto
        {
            NegocioSlug = "no-existe",
            ServicioId = Guid.NewGuid(),
            EmpleadoId = Guid.NewGuid(),
            InicioEn = DateTime.UtcNow.AddDays(2),
            NombreCliente = "Test",
            TelefonoCliente = "5500000000",
        };

        var result = await controller.CrearCita(dto);

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task RetornaBadRequest_CuandoServicioNoValido()
    {
        var (controller, negocioRepo, _, _, _, _, _) = CrearComponentes(
            nameof(RetornaBadRequest_CuandoServicioNoValido));
        var negocio = NegocioActivo();
        negocioRepo.ObtenerPorSlugAsync(negocio.Slug).Returns(negocio);
        // No se siembra ningún Servicio para este negocio

        var dto = new CrearCitaPublicaDto
        {
            NegocioSlug = negocio.Slug,
            ServicioId = Guid.NewGuid(), // inexistente
            EmpleadoId = Guid.NewGuid(),
            InicioEn = DateTime.UtcNow.AddDays(2),
            NombreCliente = "Test",
            TelefonoCliente = "5500000000",
        };

        var result = await controller.CrearCita(dto);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task RetornaBadRequest_CuandoEmpleadoNoValido()
    {
        var (controller, negocioRepo, _, _, _, _, db) = CrearComponentes(
            nameof(RetornaBadRequest_CuandoEmpleadoNoValido));
        var negocio = NegocioActivo();
        negocioRepo.ObtenerPorSlugAsync(negocio.Slug).Returns(negocio);

        // Siembra servicio pero NO empleado
        var servicio = new Servicio
        {
            Id = Guid.NewGuid(), NegocioId = negocio.Id, Nombre = "Corte",
            DuracionMinutos = 30, BufferMinutos = 0, Precio = 100m,
            Orden = 1, Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        };
        db.Servicios.Add(servicio);
        await db.SaveChangesAsync();

        var dto = new CrearCitaPublicaDto
        {
            NegocioSlug = negocio.Slug,
            ServicioId = servicio.Id,
            EmpleadoId = Guid.NewGuid(), // inexistente
            InicioEn = DateTime.UtcNow.AddDays(2),
            NombreCliente = "Test",
            TelefonoCliente = "5500000000",
        };

        var result = await controller.CrearCita(dto);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task RetornaBadRequest_CuandoEmpleadoNoOfreceServicio()
    {
        var (controller, negocioRepo, _, _, _, _, db) = CrearComponentes(
            nameof(RetornaBadRequest_CuandoEmpleadoNoOfreceServicio));
        var negocio = NegocioActivo();
        negocioRepo.ObtenerPorSlugAsync(negocio.Slug).Returns(negocio);

        // Servicio y empleado existen, pero NO hay EmpleadoServicio que los vincule
        var servicio = new Servicio
        {
            Id = Guid.NewGuid(), NegocioId = negocio.Id, Nombre = "Corte",
            DuracionMinutos = 30, BufferMinutos = 0, Precio = 100m,
            Orden = 1, Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        };
        var empleado = new Empleado
        {
            Id = Guid.NewGuid(), NegocioId = negocio.Id, Nombre = "Carlos",
            Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        };
        db.Servicios.Add(servicio);
        db.Empleados.Add(empleado);
        await db.SaveChangesAsync();
        // Intencionalmente sin EmpleadoServicio

        var dto = new CrearCitaPublicaDto
        {
            NegocioSlug = negocio.Slug,
            ServicioId = servicio.Id,
            EmpleadoId = empleado.Id,
            InicioEn = DateTime.UtcNow.AddDays(2),
            NombreCliente = "Test",
            TelefonoCliente = "5500000000",
        };

        var result = await controller.CrearCita(dto);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task RetornaConflict_CuandoSlotSolapado()
    {
        var (controller, negocioRepo, citaRepo, _, _, _, db) = CrearComponentes(
            nameof(RetornaConflict_CuandoSlotSolapado));
        var negocio = NegocioActivo();
        negocioRepo.ObtenerPorSlugAsync(negocio.Slug).Returns(negocio);

        var (servicio, empleado) = await SeedDataAsync(db, negocio.Id);
        citaRepo.ExisteSolapamientoAsync(
            Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<Guid?>())
            .Returns(true);

        var result = await controller.CrearCita(DtoBase(negocio, servicio, empleado));

        result.Should().BeOfType<ConflictObjectResult>();
    }

    [Fact]
    public async Task CreaConfirmada_CuandoAutoConfirmarEsTrue()
    {
        var (controller, negocioRepo, citaRepo, clienteRepo, _, _, db) = CrearComponentes(
            nameof(CreaConfirmada_CuandoAutoConfirmarEsTrue));
        var negocio = NegocioActivo(autoConfirmar: true);
        negocioRepo.ObtenerPorSlugAsync(negocio.Slug).Returns(negocio);

        var (servicio, empleado) = await SeedDataAsync(db, negocio.Id);
        citaRepo.ExisteSolapamientoAsync(
            Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<Guid?>())
            .Returns(false);
        clienteRepo.ObtenerOCrearAsync(
            Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string?>())
            .Returns(ClienteDemo(negocio.Id));

        var result = await controller.CrearCita(DtoBase(negocio, servicio, empleado));

        var created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var respuesta = created.Value.Should().BeOfType<ConfirmacionCitaDto>().Subject;
        respuesta.Estado.Should().Be(EstadosCitas.Confirmada,
            "AutoConfirmar=true debe crear la cita directamente como Confirmada");
    }

    [Fact]
    public async Task CreaPendiente_CuandoAutoConfirmarEsFalse()
    {
        var (controller, negocioRepo, citaRepo, clienteRepo, _, _, db) = CrearComponentes(
            nameof(CreaPendiente_CuandoAutoConfirmarEsFalse));
        var negocio = NegocioActivo(autoConfirmar: false);
        negocioRepo.ObtenerPorSlugAsync(negocio.Slug).Returns(negocio);

        var (servicio, empleado) = await SeedDataAsync(db, negocio.Id);
        citaRepo.ExisteSolapamientoAsync(
            Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<Guid?>())
            .Returns(false);
        clienteRepo.ObtenerOCrearAsync(
            Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string?>())
            .Returns(ClienteDemo(negocio.Id));

        var result = await controller.CrearCita(DtoBase(negocio, servicio, empleado));

        var created = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var respuesta = created.Value.Should().BeOfType<ConfirmacionCitaDto>().Subject;
        respuesta.Estado.Should().Be(EstadosCitas.Pendiente,
            "AutoConfirmar=false debe dejar la cita como Pendiente hasta que el negocio confirme");
    }

    [Fact]
    public async Task ConEmail_EncolarNotificacionPush()
    {
        var (controller, negocioRepo, citaRepo, clienteRepo, jobClient, _, db) = CrearComponentes(
            nameof(ConEmail_EncolarNotificacionPush));
        var negocio = NegocioActivo(autoConfirmar: true);
        negocioRepo.ObtenerPorSlugAsync(negocio.Slug).Returns(negocio);

        var (servicio, empleado) = await SeedDataAsync(db, negocio.Id);
        citaRepo.ExisteSolapamientoAsync(
            Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<Guid?>())
            .Returns(false);
        clienteRepo.ObtenerOCrearAsync(
            Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string?>())
            .Returns(ClienteDemo(negocio.Id, email: "luis@email.com"));

        var result = await controller.CrearCita(
            DtoBase(negocio, servicio, empleado, email: "luis@email.com"));

        result.Should().BeOfType<CreatedAtActionResult>();
        // La notificación push se encola siempre vía Hangfire.Enqueue → IBackgroundJobClient.Create
        jobClient.ReceivedWithAnyArgs().Create(default!, default!);
    }

    [Fact]
    public async Task SinEmail_NoEnviarNotificacionEmail()
    {
        var (controller, negocioRepo, citaRepo, clienteRepo, _, notificacion, db) = CrearComponentes(
            nameof(SinEmail_NoEnviarNotificacionEmail));
        var negocio = NegocioActivo(autoConfirmar: true);
        negocioRepo.ObtenerPorSlugAsync(negocio.Slug).Returns(negocio);

        var (servicio, empleado) = await SeedDataAsync(db, negocio.Id);
        citaRepo.ExisteSolapamientoAsync(
            Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<Guid?>())
            .Returns(false);
        clienteRepo.ObtenerOCrearAsync(
            Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string?>())
            .Returns(ClienteDemo(negocio.Id, email: null));

        var result = await controller.CrearCita(
            DtoBase(negocio, servicio, empleado, email: null));

        result.Should().BeOfType<CreatedAtActionResult>();
        await notificacion.DidNotReceive().EnviarConfirmacionCitaAsync(
            Arg.Any<Cita>(),
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<string?>(),
            Arg.Any<string?>(),
            Arg.Any<string?>(),
            Arg.Any<string?>());
    }
}
