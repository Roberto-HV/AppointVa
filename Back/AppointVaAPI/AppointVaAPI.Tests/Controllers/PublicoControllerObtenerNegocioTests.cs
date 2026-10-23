using AppointVaAPI.Controllers.V1;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Publico;
using AppointVaAPI.Repository.IRepository;
using AppointVaAPI.Services.IServices;
using FluentAssertions;
using Hangfire;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using NSubstitute;

namespace AppointVaAPI.Tests.Controllers;

/// <summary>
/// GET publico/negocios/{slug}: la reserva necesita el horario semanal, los días
/// bloqueados y la zona horaria para marcar los días cerrados sin pedir disponibilidad.
/// </summary>
public class PublicoControllerObtenerNegocioTests
{
    private static PublicoController CrearController(ApplicationDbContext db, INegocioRepository negocioRepo) =>
        new(
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

    private static Negocio NegocioActivo(Guid id) => new()
    {
        Id = id,
        Slug = "negocio-horario",
        Nombre = "Negocio Horario",
        Activo = 1,
        ZonaHoraria = "Central Standard Time (Mexico)",
        FechaCreacion = DateTime.UtcNow,
        FechaActualizacion = DateTime.UtcNow,
    };

    private static HorarioNegocio Intervalo(Guid negocioId, byte dia, string inicio, string fin, int activo = 1) => new()
    {
        Id = Guid.NewGuid(),
        NegocioId = negocioId,
        DiaSemana = dia,
        HoraInicio = TimeSpan.Parse(inicio),
        HoraFin = TimeSpan.Parse(fin),
        Activo = activo,
    };

    private static BloqueoNegocio Bloqueo(Guid negocioId, DateTime fecha) => new()
    {
        Id = Guid.NewGuid(),
        NegocioId = negocioId,
        Fecha = fecha.Date,
        FechaCreacion = DateTime.UtcNow,
    };

    private static async Task<NegocioPublicoDto> ObtenerAsync(string nombreDb, Action<ApplicationDbContext, Guid> sembrar)
    {
        var db = DbContextFactory.Create(nombreDb);
        var negocioId = Guid.NewGuid();
        var negocio = NegocioActivo(negocioId);
        db.Negocios.Add(negocio);
        sembrar(db, negocioId);
        await db.SaveChangesAsync();

        var repo = Substitute.For<INegocioRepository>();
        repo.ObtenerPorSlugAsync(negocio.Slug).Returns(negocio);

        var result = await CrearController(db, repo).ObtenerNegocio(negocio.Slug);
        return result.Should().BeOfType<OkObjectResult>().Subject.Value
            .Should().BeOfType<NegocioPublicoDto>().Subject;
    }

    [Fact]
    public async Task ObtenerNegocio_IncluyeSoloIntervalosActivos_OrdenadosPorDiaYHora()
    {
        var dto = await ObtenerAsync(nameof(ObtenerNegocio_IncluyeSoloIntervalosActivos_OrdenadosPorDiaYHora), (db, id) =>
        {
            db.HorariosNegocios.AddRange(
                Intervalo(id, 2, "15:00", "19:00"),
                Intervalo(id, 2, "10:00", "14:00"),
                Intervalo(id, 1, "09:00", "18:00"),
                Intervalo(id, 0, "09:00", "13:00", activo: 0));
        });

        dto.Horario.Select(h => (h.DiaSemana, h.HoraInicio, h.HoraFin)).Should().Equal(
            ((byte)1, "09:00", "18:00"),
            ((byte)2, "10:00", "14:00"),
            ((byte)2, "15:00", "19:00"));
    }

    [Fact]
    public async Task ObtenerNegocio_IncluyeDiasBloqueadosFuturos_SinLosYaPasados()
    {
        var hoy = DateTime.UtcNow.Date;
        var dto = await ObtenerAsync(nameof(ObtenerNegocio_IncluyeDiasBloqueadosFuturos_SinLosYaPasados), (db, id) =>
        {
            db.BloqueosNegocio.AddRange(
                Bloqueo(id, hoy.AddDays(-10)),
                Bloqueo(id, hoy.AddDays(5)),
                Bloqueo(id, hoy.AddDays(2)));
            // Un bloqueo de otro negocio no se filtra.
            db.BloqueosNegocio.Add(Bloqueo(Guid.NewGuid(), hoy.AddDays(3)));
        });

        dto.DiasCerrados.Should().Equal(
            hoy.AddDays(2).ToString("yyyy-MM-dd"),
            hoy.AddDays(5).ToString("yyyy-MM-dd"));
    }

    [Fact]
    public async Task ObtenerNegocio_ExponeZonaHorariaIana()
    {
        var dto = await ObtenerAsync(nameof(ObtenerNegocio_ExponeZonaHorariaIana), (_, _) => { });

        dto.ZonaHoraria.Should().Be("America/Mexico_City");
    }
}
