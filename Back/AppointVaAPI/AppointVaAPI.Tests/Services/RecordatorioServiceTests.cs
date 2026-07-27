using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Services;
using AppointVaAPI.Services.IServices;
using AppointVaAPI.Tests.Controllers;
using Microsoft.Extensions.Configuration;
using NSubstitute;

namespace AppointVaAPI.Tests.Services;

public class RecordatorioServiceTests
{
    private static (ApplicationDbContext db, RecordatorioService service, INotificacionService notificacion)
        CrearComponentes(string dbNombre)
    {
        var db           = DbContextFactory.Create(dbNombre);
        var notificacion = Substitute.For<INotificacionService>();
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["FrontendUrl"] = "http://localhost:5173",
                ["BackendUrl"]  = "http://localhost:5048",
            })
            .Build();
        return (db, new RecordatorioService(db, notificacion, config), notificacion);
    }

    private static async Task<Cita> SeedCitaAsync(
        ApplicationDbContext db, byte estado, string? email = null)
    {
        var negocioId  = Guid.NewGuid();
        var servicioId = Guid.NewGuid();
        var empleadoId = Guid.NewGuid();
        var clienteId  = Guid.NewGuid();

        db.Negocios.Add(new Negocio
        {
            Id                 = negocioId,
            Slug               = $"rec-test-{negocioId.ToString("N")[..8]}",
            Nombre             = "Negocio Recordatorio",
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
            Email                 = email,
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
            Estado             = estado,
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

    [Fact]
    public async Task EnviarRecordatorio_CitaConfirmada_LlamaNotificacionUnaVez()
    {
        var (db, service, notificacion) = CrearComponentes(
            nameof(EnviarRecordatorio_CitaConfirmada_LlamaNotificacionUnaVez));
        var cita = await SeedCitaAsync(db, EstadosCitas.Confirmada, "test@test.com");

        await service.EnviarRecordatorioCitaAsync(cita.Id);

        await notificacion.Received(1).EnviarRecordatorioCitaAsync(
            Arg.Any<Cita>(), Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<string?>(), Arg.Any<string?>());
    }

    [Fact]
    public async Task EnviarRecordatorio_CitaNoExiste_NoLlamaNotificacion()
    {
        var (_, service, notificacion) = CrearComponentes(
            nameof(EnviarRecordatorio_CitaNoExiste_NoLlamaNotificacion));

        await service.EnviarRecordatorioCitaAsync(Guid.NewGuid());

        await notificacion.DidNotReceive().EnviarRecordatorioCitaAsync(
            Arg.Any<Cita>(), Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<string?>(), Arg.Any<string?>());
    }

    [Fact]
    public async Task EnviarRecordatorio_CitaCancelada_NoLlamaNotificacion()
    {
        var (db, service, notificacion) = CrearComponentes(
            nameof(EnviarRecordatorio_CitaCancelada_NoLlamaNotificacion));
        var cita = await SeedCitaAsync(db, EstadosCitas.Cancelada, "test@test.com");

        await service.EnviarRecordatorioCitaAsync(cita.Id);

        await notificacion.DidNotReceive().EnviarRecordatorioCitaAsync(
            Arg.Any<Cita>(), Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<string?>(), Arg.Any<string?>());
    }

    [Fact]
    public async Task EnviarRecordatorio_CitaCompletada_NoLlamaNotificacion()
    {
        var (db, service, notificacion) = CrearComponentes(
            nameof(EnviarRecordatorio_CitaCompletada_NoLlamaNotificacion));
        var cita = await SeedCitaAsync(db, EstadosCitas.Completada, "test@test.com");

        await service.EnviarRecordatorioCitaAsync(cita.Id);

        await notificacion.DidNotReceive().EnviarRecordatorioCitaAsync(
            Arg.Any<Cita>(), Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<string?>(), Arg.Any<string?>());
    }
}
