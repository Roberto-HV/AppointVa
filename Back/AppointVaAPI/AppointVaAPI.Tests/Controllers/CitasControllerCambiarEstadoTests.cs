using AppointVaAPI.Constants;
using AppointVaAPI.Controllers.V1;
using AppointVaAPI.Jobs;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Citas;
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
/// Tests de CitasController.CambiarEstado (PATCH /api/citas/{id}/estado).
/// Cubre cambios de estado válidos e inválidos, notificaciones por email
/// (encoladas en Hangfire), creación de reseña, e inasistencias.
/// </summary>
public class CitasControllerCambiarEstadoTests
{
    private static readonly Guid NegocioId = Guid.NewGuid();

    // ── Factory ───────────────────────────────────────────────────────────────

    private static (
        CitasController controller,
        ICitaRepository citaRepo,
        IClienteRepository clienteRepo,
        IBackgroundJobClient jobClient,
        AppointVaAPI.Data.ApplicationDbContext db)
        CrearComponentes(string dbNombre, string? frontendUrl = null)
    {
        var db = DbContextFactory.Create(dbNombre);
        var citaRepo = Substitute.For<ICitaRepository>();
        var clienteRepo = Substitute.For<IClienteRepository>();
        var jobClient = Substitute.For<IBackgroundJobClient>();

        var contexto = Substitute.For<IContextoNegocio>();
        contexto.NegocioId.Returns(NegocioId);
        contexto.Rol.Returns("Propietario");

        var config = Substitute.For<IConfiguration>();
        if (frontendUrl is not null)
            config["FrontendUrl"].Returns(frontendUrl);

        var controller = new CitasController(
            citaRepo,
            clienteRepo,
            Substitute.For<IServicioRepository>(),
            contexto,
            db,
            Substitute.For<INotificacionService>(),
            jobClient,
            config);

        return (controller, citaRepo, clienteRepo, jobClient, db);
    }

    private static Cita CitaConCliente(
        byte estado = EstadosCitas.Pendiente,
        string? email = "cliente@test.com",
        Guid? clienteId = null)
    {
        var cId = clienteId ?? Guid.NewGuid();
        return new Cita
        {
            Id = Guid.NewGuid(),
            NegocioId = NegocioId,
            CodigoConfirmacion = "ABCD1234",
            ClienteId = cId,
            EmpleadoId = Guid.NewGuid(),
            ServicioId = Guid.NewGuid(),
            InicioEn = DateTime.UtcNow.AddDays(1),
            FinEn = DateTime.UtcNow.AddDays(1).AddHours(1),
            Estado = estado,
            Precio = 200m,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
            Cliente = new Cliente
            {
                Id = cId,
                NegocioId = NegocioId,
                NombreCompleto = "María García",
                Telefono = "5500001111",
                Email = email,
                TotalCitas = 1,
                CantidadInasistencias = 0,
                FechaCreacion = DateTime.UtcNow,
                FechaActualizacion = DateTime.UtcNow,
            }
        };
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task RetornaNotFound_CuandoCitaNoExiste()
    {
        var (controller, citaRepo, _, _, _) = CrearComponentes(
            nameof(RetornaNotFound_CuandoCitaNoExiste));
        citaRepo.ObtenerPorIdAsync(Arg.Any<Guid>(), NegocioId).Returns((Cita?)null);

        var result = await controller.CambiarEstado(
            Guid.NewGuid(),
            new CambiarEstadoCitaDto { NuevoEstado = EstadosCitas.Confirmada });

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task RetornaBadRequest_CuandoCitaYaCancelada()
    {
        var (controller, citaRepo, _, _, _) = CrearComponentes(
            nameof(RetornaBadRequest_CuandoCitaYaCancelada));
        var cita = CitaConCliente(estado: EstadosCitas.Cancelada);
        citaRepo.ObtenerPorIdAsync(cita.Id, NegocioId).Returns(cita);

        var result = await controller.CambiarEstado(
            cita.Id,
            new CambiarEstadoCitaDto { NuevoEstado = EstadosCitas.Pendiente });

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task RetornaBadRequest_CuandoCitaYaCompletada()
    {
        var (controller, citaRepo, _, _, _) = CrearComponentes(
            nameof(RetornaBadRequest_CuandoCitaYaCompletada));
        var cita = CitaConCliente(estado: EstadosCitas.Completada);
        citaRepo.ObtenerPorIdAsync(cita.Id, NegocioId).Returns(cita);

        var result = await controller.CambiarEstado(
            cita.Id,
            new CambiarEstadoCitaDto { NuevoEstado = EstadosCitas.Confirmada });

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task PendienteAConfirmada_CambiaEstadoYEncolaEmailConfirmacion()
    {
        var (controller, citaRepo, _, jobClient, _) = CrearComponentes(
            nameof(PendienteAConfirmada_CambiaEstadoYEncolaEmailConfirmacion));
        var cita = CitaConCliente(estado: EstadosCitas.Pendiente, email: "cliente@test.com");
        citaRepo.ObtenerPorIdAsync(cita.Id, NegocioId).Returns(cita);

        var result = await controller.CambiarEstado(
            cita.Id,
            new CambiarEstadoCitaDto { NuevoEstado = EstadosCitas.Confirmada });

        result.Should().BeOfType<OkObjectResult>();
        // Enqueue<NotificacionJob> llama internamente a IBackgroundJobClient.Create
        jobClient.Received(1).Create(Arg.Any<Job>(), Arg.Any<IState>());
    }

    [Fact]
    public async Task PendienteAConfirmada_SinEmail_NoEncolaEmailConfirmacion()
    {
        var (controller, citaRepo, _, jobClient, _) = CrearComponentes(
            nameof(PendienteAConfirmada_SinEmail_NoEncolaEmailConfirmacion));
        var cita = CitaConCliente(estado: EstadosCitas.Pendiente, email: null);
        citaRepo.ObtenerPorIdAsync(cita.Id, NegocioId).Returns(cita);

        var result = await controller.CambiarEstado(
            cita.Id,
            new CambiarEstadoCitaDto { NuevoEstado = EstadosCitas.Confirmada });

        result.Should().BeOfType<OkObjectResult>();
        jobClient.DidNotReceive().Create(Arg.Any<Job>(), Arg.Any<IState>());
    }

    [Fact]
    public async Task CualquierEstadoACancelada_EncolarEmailCancelacion()
    {
        var (controller, citaRepo, _, jobClient, _) = CrearComponentes(
            nameof(CualquierEstadoACancelada_EncolarEmailCancelacion));
        var cita = CitaConCliente(estado: EstadosCitas.Confirmada, email: "cliente@test.com");
        citaRepo.ObtenerPorIdAsync(cita.Id, NegocioId).Returns(cita);

        var result = await controller.CambiarEstado(
            cita.Id,
            new CambiarEstadoCitaDto { NuevoEstado = EstadosCitas.Cancelada, Motivo = "Cambio de planes" });

        result.Should().BeOfType<OkObjectResult>();
        jobClient.Received(1).Create(Arg.Any<Job>(), Arg.Any<IState>());
    }

    [Fact]
    public async Task ConfirmadaACompletada_CreaResenaYEncolaEmailResena()
    {
        var (controller, citaRepo, _, jobClient, db) = CrearComponentes(
            nameof(ConfirmadaACompletada_CreaResenaYEncolaEmailResena),
            frontendUrl: "https://test.com");
        var cita = CitaConCliente(estado: EstadosCitas.Confirmada, email: "cliente@test.com");
        citaRepo.ObtenerPorIdAsync(cita.Id, NegocioId).Returns(cita);

        var result = await controller.CambiarEstado(
            cita.Id,
            new CambiarEstadoCitaDto { NuevoEstado = EstadosCitas.Completada });

        result.Should().BeOfType<OkObjectResult>();
        db.Resenas.Should().HaveCount(1, "debe crearse una Resena cuando la cita se completa");
        jobClient.Received(1).Create(Arg.Any<Job>(), Arg.Any<IState>());
    }

    [Fact]
    public async Task ConfirmadaACompletada_SinEmail_NoCreaNiEncola()
    {
        var (controller, citaRepo, _, jobClient, db) = CrearComponentes(
            nameof(ConfirmadaACompletada_SinEmail_NoCreaNiEncola));
        var cita = CitaConCliente(estado: EstadosCitas.Confirmada, email: null);
        citaRepo.ObtenerPorIdAsync(cita.Id, NegocioId).Returns(cita);

        var result = await controller.CambiarEstado(
            cita.Id,
            new CambiarEstadoCitaDto { NuevoEstado = EstadosCitas.Completada });

        result.Should().BeOfType<OkObjectResult>();
        db.Resenas.Should().BeEmpty("sin email no se crea reseña ni se encola notificación");
        jobClient.DidNotReceive().Create(Arg.Any<Job>(), Arg.Any<IState>());
    }

    [Fact]
    public async Task PendienteAInasistencia_IncrementaCantidadInasistencias()
    {
        var clienteId = Guid.NewGuid();
        var (controller, citaRepo, clienteRepo, _, _) = CrearComponentes(
            nameof(PendienteAInasistencia_IncrementaCantidadInasistencias));

        var cita = CitaConCliente(estado: EstadosCitas.Pendiente, email: null, clienteId: clienteId);
        citaRepo.ObtenerPorIdAsync(cita.Id, NegocioId).Returns(cita);

        var cliente = new Cliente
        {
            Id = clienteId,
            NegocioId = NegocioId,
            NombreCompleto = "María García",
            Telefono = "5500001111",
            CantidadInasistencias = 2,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        };
        clienteRepo.ObtenerPorIdAsync(clienteId, NegocioId).Returns(cliente);

        await controller.CambiarEstado(
            cita.Id,
            new CambiarEstadoCitaDto { NuevoEstado = EstadosCitas.Inasistencia });

        await clienteRepo.Received(1)
            .ActualizarAsync(Arg.Is<Cliente>(c => c.CantidadInasistencias == 3));
    }

    [Fact]
    public async Task ConfirmadaAConfirmada_NoEncolaEmailConfirmacion()
    {
        var (controller, citaRepo, _, jobClient, _) = CrearComponentes(
            nameof(ConfirmadaAConfirmada_NoEncolaEmailConfirmacion));
        // estadoAnterior == Confirmada; la condición requiere Pendiente → no se encola
        var cita = CitaConCliente(estado: EstadosCitas.Confirmada, email: "cliente@test.com");
        citaRepo.ObtenerPorIdAsync(cita.Id, NegocioId).Returns(cita);

        var result = await controller.CambiarEstado(
            cita.Id,
            new CambiarEstadoCitaDto { NuevoEstado = EstadosCitas.Confirmada });

        result.Should().BeOfType<OkObjectResult>();
        jobClient.DidNotReceive().Create(Arg.Any<Job>(), Arg.Any<IState>());
    }
}
