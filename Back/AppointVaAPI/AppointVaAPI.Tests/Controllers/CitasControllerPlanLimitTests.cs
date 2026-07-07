using AppointVaAPI.Controllers.V1;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Citas;
using AppointVaAPI.Repository.IRepository;
using AppointVaAPI.Services.IServices;
using FluentAssertions;
using Hangfire;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using NSubstitute;

namespace AppointVaAPI.Tests.Controllers;

/// <summary>
/// Tests de CitasController enfocados en la validación del límite mensual
/// de citas por plan (HTTP 402). Se usa DbContext InMemory + NSubstitute
/// para las dependencias externas.
/// </summary>
public class CitasControllerPlanLimitTests
{
    private static readonly Guid NegocioId = Guid.NewGuid();

    private static CitasController CrearController(string dbNombre)
    {
        var db = DbContextFactory.Create(dbNombre);

        var contexto = Substitute.For<IContextoNegocio>();
        contexto.NegocioId.Returns(NegocioId);
        contexto.Rol.Returns("Propietario");

        return new CitasController(
            Substitute.For<ICitaRepository>(),
            Substitute.For<IClienteRepository>(),
            Substitute.For<IServicioRepository>(),
            contexto,
            db,
            Substitute.For<INotificacionService>(),
            Substitute.For<IBackgroundJobClient>(),
            Substitute.For<IConfiguration>()
        );
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

    private static Negocio NegocioConPlan(Guid planId) => new()
    {
        Id = NegocioId,
        Slug = "negocio-test",
        Nombre = "Negocio Test",
        Activo = 1,
        PlanId = planId,
        FechaCreacion = DateTime.UtcNow,
        FechaActualizacion = DateTime.UtcNow,
    };

    private static Cita CitaEsteMes() => new()
    {
        Id = Guid.NewGuid(),
        NegocioId = NegocioId,
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

    private static CrearCitaDto DtoFuturo() => new()
    {
        ServicioId = Guid.NewGuid(),
        EmpleadoId = Guid.NewGuid(),
        InicioEn = DateTime.UtcNow.AddDays(3),
        NombreCliente = "Test",
        TelefonoCliente = "5500000000",
    };

    // ── Tests ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Crear_Retorna402_CuandoCitasMesIgualPlanLimite()
    {
        var db = DbContextFactory.Create(nameof(Crear_Retorna402_CuandoCitasMesIgualPlanLimite));
        var plan = PlanConLimite(maxCitas: 2);
        db.Planes.Add(plan);
        db.Negocios.Add(NegocioConPlan(plan.Id));
        db.Citas.AddRange(CitaEsteMes(), CitaEsteMes()); // ya tiene 2 = límite
        await db.SaveChangesAsync();

        var contexto = Substitute.For<IContextoNegocio>();
        contexto.NegocioId.Returns(NegocioId);
        var controller = new CitasController(
            Substitute.For<ICitaRepository>(), Substitute.For<IClienteRepository>(),
            Substitute.For<IServicioRepository>(), contexto, db,
            Substitute.For<INotificacionService>(), Substitute.For<IBackgroundJobClient>(),
            Substitute.For<IConfiguration>());

        var result = await controller.Crear(DtoFuturo());

        var statusResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusResult.StatusCode.Should().Be(402);
    }

    [Fact]
    public async Task Crear_Retorna402_CuandoCitasMesSuperaPlanLimite()
    {
        var db = DbContextFactory.Create(nameof(Crear_Retorna402_CuandoCitasMesSuperaPlanLimite));
        var plan = PlanConLimite(maxCitas: 1);
        db.Planes.Add(plan);
        db.Negocios.Add(NegocioConPlan(plan.Id));
        db.Citas.AddRange(CitaEsteMes(), CitaEsteMes()); // 2 > límite de 1
        await db.SaveChangesAsync();

        var contexto = Substitute.For<IContextoNegocio>();
        contexto.NegocioId.Returns(NegocioId);
        var controller = new CitasController(
            Substitute.For<ICitaRepository>(), Substitute.For<IClienteRepository>(),
            Substitute.For<IServicioRepository>(), contexto, db,
            Substitute.For<INotificacionService>(), Substitute.For<IBackgroundJobClient>(),
            Substitute.For<IConfiguration>());

        var result = await controller.Crear(DtoFuturo());

        var statusResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusResult.StatusCode.Should().Be(402);
    }

    [Fact]
    public async Task Crear_NoRetorna402_CuandoCitasBajoDeLimite()
    {
        var db = DbContextFactory.Create(nameof(Crear_NoRetorna402_CuandoCitasBajoDeLimite));
        var plan = PlanConLimite(maxCitas: 50);
        db.Planes.Add(plan);
        db.Negocios.Add(NegocioConPlan(plan.Id));
        db.Citas.Add(CitaEsteMes()); // 1 cita, límite 50
        await db.SaveChangesAsync();

        var contexto = Substitute.For<IContextoNegocio>();
        contexto.NegocioId.Returns(NegocioId);
        var controller = new CitasController(
            Substitute.For<ICitaRepository>(), Substitute.For<IClienteRepository>(),
            Substitute.For<IServicioRepository>(), contexto, db,
            Substitute.For<INotificacionService>(), Substitute.For<IBackgroundJobClient>(),
            Substitute.For<IConfiguration>());

        var result = await controller.Crear(DtoFuturo());

        // No debe retornar 402 (puede retornar BadRequest por falta de servicio/empleado, pero no 402)
        if (result is ObjectResult obj)
            obj.StatusCode.Should().NotBe(402);
    }

    [Fact]
    public async Task Crear_NoVerificaLimite_CuandoNegocioSinPlan()
    {
        var db = DbContextFactory.Create(nameof(Crear_NoVerificaLimite_CuandoNegocioSinPlan));
        db.Negocios.Add(new Negocio
        {
            Id = NegocioId, Slug = "sin-plan", Nombre = "Sin Plan",
            Activo = 1, PlanId = null,
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        });
        // Agrega 100 citas — sin plan no debe bloquear
        for (int i = 0; i < 5; i++) db.Citas.Add(CitaEsteMes());
        await db.SaveChangesAsync();

        var contexto = Substitute.For<IContextoNegocio>();
        contexto.NegocioId.Returns(NegocioId);
        var controller = new CitasController(
            Substitute.For<ICitaRepository>(), Substitute.For<IClienteRepository>(),
            Substitute.For<IServicioRepository>(), contexto, db,
            Substitute.For<INotificacionService>(), Substitute.For<IBackgroundJobClient>(),
            Substitute.For<IConfiguration>());

        var result = await controller.Crear(DtoFuturo());

        if (result is ObjectResult obj)
            obj.StatusCode.Should().NotBe(402);
    }

    [Fact]
    public async Task Crear_Retorna400_CuandoFechaEnElPasado()
    {
        var controller = CrearController(nameof(Crear_Retorna400_CuandoFechaEnElPasado));
        var dto = new CrearCitaDto
        {
            ServicioId = Guid.NewGuid(), EmpleadoId = Guid.NewGuid(),
            InicioEn = DateTime.UtcNow.AddHours(-1), // pasado
            NombreCliente = "Test", TelefonoCliente = "5500000000",
        };

        var result = await controller.Crear(dto);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Crear_Retorna401_CuandoNegocioIdEsNull()
    {
        var db = DbContextFactory.Create(nameof(Crear_Retorna401_CuandoNegocioIdEsNull));
        var contexto = Substitute.For<IContextoNegocio>();
        contexto.NegocioId.Returns((Guid?)null);
        var controller = new CitasController(
            Substitute.For<ICitaRepository>(), Substitute.For<IClienteRepository>(),
            Substitute.For<IServicioRepository>(), contexto, db,
            Substitute.For<INotificacionService>(), Substitute.For<IBackgroundJobClient>(),
            Substitute.For<IConfiguration>());

        var result = await controller.Crear(DtoFuturo());

        result.Should().BeOfType<UnauthorizedResult>();
    }

    [Fact]
    public async Task Crear_MensajeError402_ContieneNumeroDeLimit()
    {
        var db = DbContextFactory.Create(nameof(Crear_MensajeError402_ContieneNumeroDeLimit));
        var plan = PlanConLimite(maxCitas: 10);
        db.Planes.Add(plan);
        db.Negocios.Add(NegocioConPlan(plan.Id));
        for (int i = 0; i < 10; i++) db.Citas.Add(CitaEsteMes());
        await db.SaveChangesAsync();

        var contexto = Substitute.For<IContextoNegocio>();
        contexto.NegocioId.Returns(NegocioId);
        var controller = new CitasController(
            Substitute.For<ICitaRepository>(), Substitute.For<IClienteRepository>(),
            Substitute.For<IServicioRepository>(), contexto, db,
            Substitute.For<INotificacionService>(), Substitute.For<IBackgroundJobClient>(),
            Substitute.For<IConfiguration>());

        var result = await controller.Crear(DtoFuturo());

        var statusResult = result.Should().BeOfType<ObjectResult>().Subject;
        var mensaje = statusResult.Value?.ToString() ?? "";
        mensaje.Should().Contain("10", "el mensaje debe incluir el límite del plan");
    }
}
