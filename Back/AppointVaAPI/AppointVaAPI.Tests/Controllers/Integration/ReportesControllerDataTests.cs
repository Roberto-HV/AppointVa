using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class ReportesControllerDataTests : IntegrationTestBase
{
    public ReportesControllerDataTests(CustomWebApplicationFactory factory) : base(factory) { }

    private async Task<(Guid negocioId, Guid servicioId, Guid empleadoId)> SeedReportesDataAsync()
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var negocioId  = Guid.NewGuid();
        var servicioId = Guid.NewGuid();
        var empleadoId = Guid.NewGuid();
        var clienteId  = Guid.NewGuid();

        db.Negocios.Add(new Negocio
        {
            Id                 = negocioId,
            Slug               = $"reportes-test-{negocioId.ToString("N")[..8]}",
            Nombre             = "Salon Reportes",
            ZonaHoraria        = "UTC",
            AutoConfirmar      = true,
            HorasCancelacion   = 0,
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
            NombreCompleto        = "Cliente Reporte",
            Telefono              = "5500000001",
            TotalCitas            = 0,
            CantidadInasistencias = 0,
            FechaCreacion         = DateTime.UtcNow,
            FechaActualizacion    = DateTime.UtcNow,
        });

        var startOfMonth = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        db.Citas.AddRange(
            new Cita
            {
                Id                 = Guid.NewGuid(),
                CodigoConfirmacion = Guid.NewGuid().ToString("N")[..8].ToUpper(),
                NegocioId          = negocioId,
                ClienteId          = clienteId,
                EmpleadoId         = empleadoId,
                ServicioId         = servicioId,
                Estado             = EstadosCitas.Completada,
                Precio             = 100m,
                Pagada             = false,
                InicioEn           = startOfMonth.AddDays(1).AddHours(9),
                FinEn              = startOfMonth.AddDays(1).AddHours(9).AddMinutes(30),
                FechaCreacion      = DateTime.UtcNow,
                FechaActualizacion = DateTime.UtcNow,
            },
            new Cita
            {
                Id                 = Guid.NewGuid(),
                CodigoConfirmacion = Guid.NewGuid().ToString("N")[..8].ToUpper(),
                NegocioId          = negocioId,
                ClienteId          = clienteId,
                EmpleadoId         = empleadoId,
                ServicioId         = servicioId,
                Estado             = EstadosCitas.Completada,
                Precio             = 200m,
                Pagada             = true,
                MetodoPago         = "efectivo",
                InicioEn           = startOfMonth.AddDays(2).AddHours(10),
                FinEn              = startOfMonth.AddDays(2).AddHours(10).AddMinutes(30),
                FechaCreacion      = DateTime.UtcNow,
                FechaActualizacion = DateTime.UtcNow,
            },
            new Cita
            {
                Id                 = Guid.NewGuid(),
                CodigoConfirmacion = Guid.NewGuid().ToString("N")[..8].ToUpper(),
                NegocioId          = negocioId,
                ClienteId          = clienteId,
                EmpleadoId         = empleadoId,
                ServicioId         = servicioId,
                Estado             = EstadosCitas.Completada,
                Precio             = 300m,
                Pagada             = true,
                MetodoPago         = "tarjeta",
                InicioEn           = startOfMonth.AddDays(3).AddHours(11),
                FinEn              = startOfMonth.AddDays(3).AddHours(11).AddMinutes(30),
                FechaCreacion      = DateTime.UtcNow,
                FechaActualizacion = DateTime.UtcNow,
            },
            new Cita
            {
                Id                 = Guid.NewGuid(),
                CodigoConfirmacion = Guid.NewGuid().ToString("N")[..8].ToUpper(),
                NegocioId          = negocioId,
                ClienteId          = clienteId,
                EmpleadoId         = empleadoId,
                ServicioId         = servicioId,
                Estado             = EstadosCitas.Cancelada,
                Precio             = 150m,
                InicioEn           = startOfMonth.AddDays(4).AddHours(9),
                FinEn              = startOfMonth.AddDays(4).AddHours(9).AddMinutes(30),
                FechaCreacion      = DateTime.UtcNow,
                FechaActualizacion = DateTime.UtcNow,
            },
            new Cita
            {
                Id                 = Guid.NewGuid(),
                CodigoConfirmacion = Guid.NewGuid().ToString("N")[..8].ToUpper(),
                NegocioId          = negocioId,
                ClienteId          = clienteId,
                EmpleadoId         = empleadoId,
                ServicioId         = servicioId,
                Estado             = EstadosCitas.Pendiente,
                Precio             = 250m,
                InicioEn           = DateTime.UtcNow.AddDays(2),
                FinEn              = DateTime.UtcNow.AddDays(2).AddMinutes(30),
                FechaCreacion      = DateTime.UtcNow,
                FechaActualizacion = DateTime.UtcNow,
            }
        );

        await db.SaveChangesAsync();
        return (negocioId, servicioId, empleadoId);
    }

    [Fact]
    public async Task ReportesCitas_ConDatosSeeded_Retorna200ConTotalesCorrectos()
    {
        var (negocioId, _, _) = await SeedReportesDataAsync();
        var client = NewClient(TestTokenHelper.Propietario(negocioId));

        var response = await client.GetAsync("/api/reportes/citas");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("totalCitas").GetInt32().Should().Be(5);
        body.GetProperty("totalCompletadas").GetInt32().Should().Be(3);
        body.GetProperty("totalCanceladas").GetInt32().Should().Be(1);
        body.GetProperty("totalIngresos").GetDecimal().Should().Be(600.0m);
    }

    [Fact]
    public async Task ReportesCitas_ExportarCSV_Retorna200ConContentTypeCsv()
    {
        var (negocioId, _, _) = await SeedReportesDataAsync();
        var client = NewClient(TestTokenHelper.Propietario(negocioId));

        var response = await client.GetAsync("/api/reportes/citas/exportar");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.Should().Contain("text/csv");
    }

    [Fact]
    public async Task ReportesIngresos_ConDatosSeeded_Retorna200ConIngresosCorrectos()
    {
        var (negocioId, _, _) = await SeedReportesDataAsync();
        var client = NewClient(TestTokenHelper.Propietario(negocioId));

        var response = await client.GetAsync("/api/reportes/ingresos");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("totalIngresos").GetDecimal().Should().Be(600.0m);
        body.GetProperty("totalCitasCompletadas").GetInt32().Should().Be(3);
        body.GetProperty("ticketPromedio").GetDecimal().Should().Be(200.0m);
    }

    [Fact]
    public async Task ReportesHeatmap_ConDatosSeeded_Retorna200ConMatriz24x7()
    {
        var (negocioId, _, _) = await SeedReportesDataAsync();
        var client = NewClient(TestTokenHelper.Propietario(negocioId));

        var response = await client.GetAsync("/api/reportes/heatmap");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("totalCitas").GetInt32().Should().BeGreaterThanOrEqualTo(3);
        body.GetProperty("matriz").GetArrayLength().Should().Be(24);
    }

    [Fact]
    public async Task ReportesRetencion_ConDatosSeeded_Retorna200()
    {
        var (negocioId, _, _) = await SeedReportesDataAsync();
        var client = NewClient(TestTokenHelper.Propietario(negocioId));

        var response = await client.GetAsync("/api/reportes/retencion");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("totalClientes").GetInt32().Should().BeGreaterThanOrEqualTo(1);
    }
}
