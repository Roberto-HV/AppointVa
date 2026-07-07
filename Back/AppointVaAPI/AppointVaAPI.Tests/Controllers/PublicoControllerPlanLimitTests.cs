using AppointVaAPI.Controllers.V1;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Publico;
using AppointVaAPI.Repository.IRepository;
using AppointVaAPI.Services.IServices;
using FluentAssertions;
using Hangfire;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using NSubstitute;

namespace AppointVaAPI.Tests.Controllers;

/// <summary>
/// Tests de PublicoController enfocados en el límite mensual de citas (HTTP 402).
/// El plan limit se verifica inmediatamente después de obtener el negocio,
/// por lo que el flujo de test no necesita llegar hasta UserManager ni Hangfire.
/// </summary>
public class PublicoControllerPlanLimitTests
{
    private static PublicoController CrearController(
        ApplicationDbContext db,
        INegocioRepository negocioRepo)
    {
        // UserManager no se usa en el código path de 402 — se pasa null intencionalmente
        return new PublicoController(
            db,
            negocioRepo,
            Substitute.For<ICitaRepository>(),
            Substitute.For<IClienteRepository>(),
            Substitute.For<IDisponibilidadService>(),
            Substitute.For<INotificacionService>(),
            Substitute.For<IEmailService>(),
            Substitute.For<IConfiguration>(),
            Substitute.For<IBackgroundJobClient>(),
            null!,
            Substitute.For<IBlobStorageService>(),
            Substitute.For<IPushService>());
    }

    private static Plan PlanConLimite(int maxCitas) => new()
    {
        Id = Guid.NewGuid(),
        Nombre = "Plan Test",
        PrecioMensual = 299m,
        MaxCitasMes = maxCitas,
        MaxEmpleados = 5,
        Activo = 1,
        FechaCreacion = DateTime.UtcNow,
    };

    private static Negocio NegocioActivo(Guid negocioId, Guid? planId = null) => new()
    {
        Id = negocioId,
        Slug = "negocio-test",
        Nombre = "Negocio Test",
        Activo = 1,
        PlanId = planId,
        FechaCreacion = DateTime.UtcNow,
        FechaActualizacion = DateTime.UtcNow,
    };

    private static Cita CitaEsteMes(Guid negocioId) => new()
    {
        Id = Guid.NewGuid(),
        NegocioId = negocioId,
        CodigoConfirmacion = Guid.NewGuid().ToString("N"),
        ClienteId = Guid.NewGuid(),
        EmpleadoId = Guid.NewGuid(),
        ServicioId = Guid.NewGuid(),
        InicioEn = DateTime.UtcNow.AddDays(-1),
        FinEn = DateTime.UtcNow.AddDays(-1).AddHours(1),
        Estado = 1,
        Precio = 100m,
        FechaCreacion = DateTime.UtcNow,
        FechaActualizacion = DateTime.UtcNow,
    };

    private static CrearCitaPublicaDto DtoValido() => new()
    {
        NegocioSlug = "negocio-test",
        ServicioId = Guid.NewGuid(),
        EmpleadoId = Guid.NewGuid(),
        InicioEn = DateTime.UtcNow.AddDays(3),
        NombreCliente = "Cliente Test",
        TelefonoCliente = "5500000000",
    };

    // ── Tests ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CrearCita_Retorna402_CuandoNegocioAlcanzaLimiteDePlan()
    {
        var db = DbContextFactory.Create(nameof(CrearCita_Retorna402_CuandoNegocioAlcanzaLimiteDePlan));
        var negocioId = Guid.NewGuid();
        var plan = PlanConLimite(maxCitas: 3);
        var negocio = NegocioActivo(negocioId, plan.Id);
        db.Planes.Add(plan);
        db.Negocios.Add(negocio);
        for (int i = 0; i < 3; i++) db.Citas.Add(CitaEsteMes(negocioId));
        await db.SaveChangesAsync();

        var negocioRepo = Substitute.For<INegocioRepository>();
        negocioRepo.ObtenerPorSlugAsync("negocio-test").Returns(negocio);
        var controller = CrearController(db, negocioRepo);

        var result = await controller.CrearCita(DtoValido());

        var obj = result.Should().BeOfType<ObjectResult>().Subject;
        obj.StatusCode.Should().Be(402);
    }

    [Fact]
    public async Task CrearCita_Retorna402_CuandoCitasSuperapLimite()
    {
        var db = DbContextFactory.Create(nameof(CrearCita_Retorna402_CuandoCitasSuperapLimite));
        var negocioId = Guid.NewGuid();
        var plan = PlanConLimite(maxCitas: 2);
        var negocio = NegocioActivo(negocioId, plan.Id);
        db.Planes.Add(plan);
        db.Negocios.Add(negocio);
        for (int i = 0; i < 5; i++) db.Citas.Add(CitaEsteMes(negocioId)); // 5 > límite 2
        await db.SaveChangesAsync();

        var negocioRepo = Substitute.For<INegocioRepository>();
        negocioRepo.ObtenerPorSlugAsync("negocio-test").Returns(negocio);

        var result = await CrearController(db, negocioRepo).CrearCita(DtoValido());

        result.Should().BeOfType<ObjectResult>()
            .Which.StatusCode.Should().Be(402);
    }

    [Fact]
    public async Task CrearCita_NoRetorna402_CuandoNegocioSinPlan()
    {
        var db = DbContextFactory.Create(nameof(CrearCita_NoRetorna402_CuandoNegocioSinPlan));
        var negocioId = Guid.NewGuid();
        var negocio = NegocioActivo(negocioId, planId: null); // sin plan
        db.Negocios.Add(negocio);
        for (int i = 0; i < 100; i++) db.Citas.Add(CitaEsteMes(negocioId));
        await db.SaveChangesAsync();

        var negocioRepo = Substitute.For<INegocioRepository>();
        negocioRepo.ObtenerPorSlugAsync("negocio-test").Returns(negocio);

        var result = await CrearController(db, negocioRepo).CrearCita(DtoValido());

        if (result is ObjectResult obj)
            obj.StatusCode.Should().NotBe(402, "sin plan no debe haber límite");
    }

    [Fact]
    public async Task CrearCita_NoRetorna402_CuandoCitasBajoDelLimite()
    {
        var db = DbContextFactory.Create(nameof(CrearCita_NoRetorna402_CuandoCitasBajoDelLimite));
        var negocioId = Guid.NewGuid();
        var plan = PlanConLimite(maxCitas: 50);
        var negocio = NegocioActivo(negocioId, plan.Id);
        db.Planes.Add(plan);
        db.Negocios.Add(negocio);
        db.Citas.Add(CitaEsteMes(negocioId)); // 1 de 50
        await db.SaveChangesAsync();

        var negocioRepo = Substitute.For<INegocioRepository>();
        negocioRepo.ObtenerPorSlugAsync("negocio-test").Returns(negocio);

        var result = await CrearController(db, negocioRepo).CrearCita(DtoValido());

        if (result is ObjectResult obj)
            obj.StatusCode.Should().NotBe(402);
    }

    [Fact]
    public async Task CrearCita_Retorna404_CuandoNegocioNoExiste()
    {
        var db = DbContextFactory.Create(nameof(CrearCita_Retorna404_CuandoNegocioNoExiste));
        var negocioRepo = Substitute.For<INegocioRepository>();
        negocioRepo.ObtenerPorSlugAsync(Arg.Any<string>()).Returns((Negocio?)null);

        var result = await CrearController(db, negocioRepo).CrearCita(DtoValido());

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task CrearCita_Retorna404_CuandoNegocioInactivo()
    {
        var db = DbContextFactory.Create(nameof(CrearCita_Retorna404_CuandoNegocioInactivo));
        var negocioInactivo = new Negocio
        {
            Id = Guid.NewGuid(), Slug = "negocio-test", Nombre = "Inactivo",
            Activo = 0, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        };
        var negocioRepo = Substitute.For<INegocioRepository>();
        negocioRepo.ObtenerPorSlugAsync("negocio-test").Returns(negocioInactivo);

        var result = await CrearController(db, negocioRepo).CrearCita(DtoValido());

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task CrearCita_MensajeError402_MencionaContactarNegocio()
    {
        var db = DbContextFactory.Create(nameof(CrearCita_MensajeError402_MencionaContactarNegocio));
        var negocioId = Guid.NewGuid();
        var plan = PlanConLimite(maxCitas: 1);
        var negocio = NegocioActivo(negocioId, plan.Id);
        db.Planes.Add(plan);
        db.Negocios.Add(negocio);
        db.Citas.Add(CitaEsteMes(negocioId));
        await db.SaveChangesAsync();

        var negocioRepo = Substitute.For<INegocioRepository>();
        negocioRepo.ObtenerPorSlugAsync("negocio-test").Returns(negocio);

        var result = await CrearController(db, negocioRepo).CrearCita(DtoValido());

        var obj = result.Should().BeOfType<ObjectResult>().Subject;
        obj.StatusCode.Should().Be(402);
        obj.Value?.ToString().Should().Contain("límite", "el mensaje debe mencionar el límite");
    }
}
