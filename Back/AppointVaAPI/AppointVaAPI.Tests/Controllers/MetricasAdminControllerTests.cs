using AppointVaAPI.Controllers.V1;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Negocios;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;

namespace AppointVaAPI.Tests.Controllers;

/// <summary>
/// Tests de MetricasAdminController usando DbContext InMemory.
/// Es el controller más simple — solo depende de ApplicationDbContext.
/// </summary>
public class MetricasAdminControllerTests
{
    private static MetricasAdminController CrearController(string dbNombre)
    {
        var db = DbContextFactory.Create(dbNombre);
        return new MetricasAdminController(db);
    }

    // ── Helpers de datos ──────────────────────────────────────────────────────

    private static Plan PlanBasico(int maxCitas = 50, int maxEmpleados = 5) => new()
    {
        Id = Guid.NewGuid(),
        Nombre = "Básico",
        PrecioMensual = 299m,
        MaxCitasMes = maxCitas,
        MaxEmpleados = maxEmpleados,
        Activo = 1,
        FechaCreacion = DateTime.UtcNow,
    };

    private static Negocio NegocioActivo(Guid? planId = null) => new()
    {
        Id = Guid.NewGuid(),
        Slug = $"negocio-{Guid.NewGuid():N}",
        Nombre = "Salón Test",
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

    private static Cita CitaMesAnterior(Guid negocioId) => new()
    {
        Id = Guid.NewGuid(),
        NegocioId = negocioId,
        CodigoConfirmacion = Guid.NewGuid().ToString("N"),
        ClienteId = Guid.NewGuid(),
        EmpleadoId = Guid.NewGuid(),
        ServicioId = Guid.NewGuid(),
        InicioEn = DateTime.UtcNow.AddMonths(-1),
        FinEn = DateTime.UtcNow.AddMonths(-1).AddHours(1),
        Estado = 1,
        Precio = 100m,
        FechaCreacion = DateTime.UtcNow,
        FechaActualizacion = DateTime.UtcNow,
    };

    private static Empleado EmpleadoActivo(Guid negocioId) => new()
    {
        Id = Guid.NewGuid(),
        NegocioId = negocioId,
        Nombre = "Empleado Test",
        Activo = 1,
        FechaCreacion = DateTime.UtcNow,
        FechaActualizacion = DateTime.UtcNow,
    };

    private static EmailLog EmailEsteMes(Guid negocioId) => new()
    {
        Id = Guid.NewGuid(),
        NegocioId = negocioId,
        Tipo = "Confirmacion",
        EnviadoEn = DateTime.UtcNow.AddDays(-2),
    };

    // ── Tests ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task RetornaListaVacia_CuandoNoHayNegocios()
    {
        var controller = CrearController(nameof(RetornaListaVacia_CuandoNoHayNegocios));

        var result = await controller.ObtenerMetricasNegocios();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var lista = ok.Value.Should().BeAssignableTo<IEnumerable<NegocioMetricasDto>>().Subject;
        lista.Should().BeEmpty();
    }

    [Fact]
    public async Task RetornaSoloNegociosActivos_ExcluyeEliminados()
    {
        var db = DbContextFactory.Create(nameof(RetornaSoloNegociosActivos_ExcluyeEliminados));
        db.Negocios.Add(NegocioActivo());
        var eliminado = NegocioActivo();
        eliminado.FechaEliminacion = DateTime.UtcNow.AddDays(-10);
        db.Negocios.Add(eliminado);
        await db.SaveChangesAsync();
        var controller = new MetricasAdminController(db);

        var result = await controller.ObtenerMetricasNegocios();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var lista = ok.Value.Should().BeAssignableTo<IEnumerable<NegocioMetricasDto>>().Subject.ToList();
        lista.Should().HaveCount(1);
    }

    [Fact]
    public async Task CitasMes_ContabilizaSoloCitasDelMesActual()
    {
        var db = DbContextFactory.Create(nameof(CitasMes_ContabilizaSoloCitasDelMesActual));
        var negocio = NegocioActivo();
        db.Negocios.Add(negocio);
        db.Citas.Add(CitaEsteMes(negocio.Id));
        db.Citas.Add(CitaEsteMes(negocio.Id));
        db.Citas.Add(CitaMesAnterior(negocio.Id)); // no debe contar
        await db.SaveChangesAsync();
        var controller = new MetricasAdminController(db);

        var result = await controller.ObtenerMetricasNegocios();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var item = ok.Value.Should().BeAssignableTo<IEnumerable<NegocioMetricasDto>>().Subject.First();
        item.CitasMes.Should().Be(2, "solo citas de este mes deben contabilizarse");
    }

    [Fact]
    public async Task CitasMes_CeroCuandoNegocioSinCitas()
    {
        var db = DbContextFactory.Create(nameof(CitasMes_CeroCuandoNegocioSinCitas));
        db.Negocios.Add(NegocioActivo());
        await db.SaveChangesAsync();
        var controller = new MetricasAdminController(db);

        var result = await controller.ObtenerMetricasNegocios();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var item = ok.Value.Should().BeAssignableTo<IEnumerable<NegocioMetricasDto>>().Subject.First();
        item.CitasMes.Should().Be(0);
    }

    [Fact]
    public async Task EmpleadosActivos_ExcluyeEliminados()
    {
        var db = DbContextFactory.Create(nameof(EmpleadosActivos_ExcluyeEliminados));
        var negocio = NegocioActivo();
        db.Negocios.Add(negocio);
        db.Empleados.Add(EmpleadoActivo(negocio.Id));
        db.Empleados.Add(EmpleadoActivo(negocio.Id));
        var eliminado = EmpleadoActivo(negocio.Id);
        eliminado.FechaEliminacion = DateTime.UtcNow;
        db.Empleados.Add(eliminado);
        await db.SaveChangesAsync();
        var controller = new MetricasAdminController(db);

        var result = await controller.ObtenerMetricasNegocios();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var item = ok.Value.Should().BeAssignableTo<IEnumerable<NegocioMetricasDto>>().Subject.First();
        item.EmpleadosActivos.Should().Be(2, "empleados eliminados no cuentan");
    }

    [Fact]
    public async Task EmailsMes_ContabilizaSoloEmailsDelMesActual()
    {
        var db = DbContextFactory.Create(nameof(EmailsMes_ContabilizaSoloEmailsDelMesActual));
        var negocio = NegocioActivo();
        db.Negocios.Add(negocio);
        db.EmailLogs.Add(EmailEsteMes(negocio.Id));
        db.EmailLogs.Add(EmailEsteMes(negocio.Id));
        db.EmailLogs.Add(new EmailLog // mes anterior
        {
            Id = Guid.NewGuid(), NegocioId = negocio.Id,
            Tipo = "Recordatorio", EnviadoEn = DateTime.UtcNow.AddMonths(-1),
        });
        await db.SaveChangesAsync();
        var controller = new MetricasAdminController(db);

        var result = await controller.ObtenerMetricasNegocios();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var item = ok.Value.Should().BeAssignableTo<IEnumerable<NegocioMetricasDto>>().Subject.First();
        item.EmailsMes.Should().Be(2);
    }

    [Fact]
    public async Task MaxCitasMes_SeRefleja_DesdeElPlanAsignado()
    {
        var db = DbContextFactory.Create(nameof(MaxCitasMes_SeRefleja_DesdeElPlanAsignado));
        var plan = PlanBasico(maxCitas: 75);
        db.Planes.Add(plan);
        var negocio = NegocioActivo(plan.Id);
        db.Negocios.Add(negocio);
        await db.SaveChangesAsync();
        var controller = new MetricasAdminController(db);

        var result = await controller.ObtenerMetricasNegocios();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var item = ok.Value.Should().BeAssignableTo<IEnumerable<NegocioMetricasDto>>().Subject.First();
        item.MaxCitasMes.Should().Be(75);
    }

    [Fact]
    public async Task MetricasSonAisladas_CadaNegocioSoloVeSusDatos()
    {
        var db = DbContextFactory.Create(nameof(MetricasSonAisladas_CadaNegocioSoloVeSusDatos));
        var negocioA = NegocioActivo();
        var negocioB = NegocioActivo();
        db.Negocios.AddRange(negocioA, negocioB);
        db.Citas.Add(CitaEsteMes(negocioA.Id));
        db.Citas.Add(CitaEsteMes(negocioA.Id));
        db.Citas.Add(CitaEsteMes(negocioB.Id));
        await db.SaveChangesAsync();
        var controller = new MetricasAdminController(db);

        var result = await controller.ObtenerMetricasNegocios();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var lista = ok.Value.Should().BeAssignableTo<IEnumerable<NegocioMetricasDto>>().Subject.ToList();
        var totales = lista.Select(x => x.CitasMes).OrderByDescending(x => x).ToList();
        totales[0].Should().Be(2, "negocio A tiene 2 citas este mes");
        totales[1].Should().Be(1, "negocio B tiene 1 cita este mes");
    }

    [Fact]
    public async Task RetornaOk_ConMultiplesNegocios()
    {
        var db = DbContextFactory.Create(nameof(RetornaOk_ConMultiplesNegocios));
        db.Negocios.AddRange(NegocioActivo(), NegocioActivo(), NegocioActivo());
        await db.SaveChangesAsync();
        var controller = new MetricasAdminController(db);

        var result = await controller.ObtenerMetricasNegocios();

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var lista = ok.Value.Should().BeAssignableTo<IEnumerable<NegocioMetricasDto>>().Subject.ToList();
        lista.Should().HaveCount(3);
    }
}
