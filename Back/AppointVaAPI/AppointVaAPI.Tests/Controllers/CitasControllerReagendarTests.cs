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

public class CitasControllerReagendarTests
{
    private static readonly Guid NegocioId = Guid.NewGuid();

    private static (
        CitasController controller,
        ICitaRepository citaRepo,
        IBackgroundJobClient jobClient)
        CrearComponentes(string dbNombre)
    {
        var db = DbContextFactory.Create(dbNombre);
        var citaRepo = Substitute.For<ICitaRepository>();
        var jobClient = Substitute.For<IBackgroundJobClient>();

        var contexto = Substitute.For<IContextoNegocio>();
        contexto.NegocioId.Returns(NegocioId);
        contexto.Rol.Returns("Propietario");

        var controller = new CitasController(
            citaRepo,
            Substitute.For<IClienteRepository>(),
            Substitute.For<IServicioRepository>(),
            contexto,
            db,
            Substitute.For<INotificacionService>(),
            jobClient,
            Substitute.For<IConfiguration>());

        return (controller, citaRepo, jobClient);
    }

    private static Cita CitaReagendable(string? email = "cliente@test.com") => new()
    {
        Id = Guid.NewGuid(),
        NegocioId = NegocioId,
        ServicioId = Guid.NewGuid(),
        CodigoConfirmacion = "TEST0001",
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
            Email = email,
            TotalCitas = 1,
            CantidadInasistencias = 0,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow
        }
    };

    [Fact]
    public async Task Reagendar_ClienteConEmail_EncolaNotificacionCorreo()
    {
        var (controller, citaRepo, jobClient) = CrearComponentes(
            nameof(Reagendar_ClienteConEmail_EncolaNotificacionCorreo));

        var cita = CitaReagendable(email: "cliente@test.com");
        citaRepo.ObtenerPorIdAsync(cita.Id, NegocioId).Returns(cita);
        citaRepo.ExisteSolapamientoAsync(cita.EmpleadoId, Arg.Any<DateTime>(), Arg.Any<DateTime>(), cita.Id)
            .Returns(false);

        var result = await controller.Reagendar(cita.Id, new ReagendarCitaDto
        {
            InicioEn = DateTime.UtcNow.AddDays(2)
        });

        result.Should().BeOfType<OkObjectResult>();
        jobClient.Received(1).Create(
            Arg.Is<Job>(j => j.Method.Name == nameof(NotificacionJob.EnviarReagendaAsync)),
            Arg.Any<IState>());
    }

    [Fact]
    public async Task Reagendar_ClienteSinEmail_TambienEncolaNotificacion()
    {
        var (controller, citaRepo, jobClient) = CrearComponentes(
            nameof(Reagendar_ClienteSinEmail_TambienEncolaNotificacion));

        var cita = CitaReagendable(email: null);
        citaRepo.ObtenerPorIdAsync(cita.Id, NegocioId).Returns(cita);
        citaRepo.ExisteSolapamientoAsync(cita.EmpleadoId, Arg.Any<DateTime>(), Arg.Any<DateTime>(), cita.Id)
            .Returns(false);

        var result = await controller.Reagendar(cita.Id, new ReagendarCitaDto
        {
            InicioEn = DateTime.UtcNow.AddDays(2)
        });

        result.Should().BeOfType<OkObjectResult>();
        jobClient.Received(1).Create(
            Arg.Is<Job>(j => j.Method.Name == nameof(NotificacionJob.EnviarReagendaAsync)),
            Arg.Any<IState>());
    }

    [Fact]
    public async Task Reagendar_SiempreEncolaPushAlEmpleado()
    {
        var (controller, citaRepo, jobClient) = CrearComponentes(
            nameof(Reagendar_SiempreEncolaPushAlEmpleado));

        var cita = CitaReagendable();
        citaRepo.ObtenerPorIdAsync(cita.Id, NegocioId).Returns(cita);
        citaRepo.ExisteSolapamientoAsync(cita.EmpleadoId, Arg.Any<DateTime>(), Arg.Any<DateTime>(), cita.Id)
            .Returns(false);

        await controller.Reagendar(cita.Id, new ReagendarCitaDto
        {
            InicioEn = DateTime.UtcNow.AddDays(2)
        });

        jobClient.Received(1).Create(
            Arg.Is<Job>(j => j.Method.Name == nameof(IPushService.EnviarReagendarEmpleadoAsync)),
            Arg.Any<IState>());
    }

    [Fact]
    public async Task Reagendar_ConSolapamiento_NoEncolaJobs()
    {
        var (controller, citaRepo, jobClient) = CrearComponentes(
            nameof(Reagendar_ConSolapamiento_NoEncolaJobs));

        var cita = CitaReagendable();
        citaRepo.ObtenerPorIdAsync(cita.Id, NegocioId).Returns(cita);
        citaRepo.ExisteSolapamientoAsync(cita.EmpleadoId, Arg.Any<DateTime>(), Arg.Any<DateTime>(), cita.Id)
            .Returns(true);

        var result = await controller.Reagendar(cita.Id, new ReagendarCitaDto
        {
            InicioEn = DateTime.UtcNow.AddDays(2)
        });

        result.Should().BeOfType<ConflictObjectResult>();
        jobClient.DidNotReceive().Create(Arg.Any<Job>(), Arg.Any<IState>());
    }
}
