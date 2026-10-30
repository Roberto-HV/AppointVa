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
                // Fixed day inside the month: "today + 2" fell into next month during the
                // last two days of every month and the report then counted 4, not 5.
                InicioEn           = startOfMonth.AddDays(5).AddHours(9),
                FinEn              = startOfMonth.AddDays(5).AddHours(9).AddMinutes(30),
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

    // G3: appointments of a soft-deleted client disappeared from the report. Cliente
    // has a global query filter (FechaEliminacion == null) and Cita.Cliente is a
    // required navigation, so Include(c => c.Cliente) became an INNER JOIN that
    // silently dropped those rows (October: 16 in the database, 9 in Reportes).
    private async Task SeedCitasDeClienteEliminadoAsync(Guid negocioId, Guid servicioId, Guid empleadoId)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var clienteId = Guid.NewGuid();
        db.Clientes.Add(new Cliente
        {
            Id                    = clienteId,
            NegocioId             = negocioId,
            NombreCompleto        = "Cliente Borrado",
            Telefono              = "5500000002",
            Email                 = "borrado@test.com",
            FechaCreacion         = DateTime.UtcNow,
            FechaActualizacion    = DateTime.UtcNow,
            FechaEliminacion      = DateTime.UtcNow,
        });
        var startOfMonth = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        Cita Nueva(byte estado, int dia, decimal precio) => new()
        {
            Id                 = Guid.NewGuid(),
            CodigoConfirmacion = Guid.NewGuid().ToString("N")[..8].ToUpper(),
            NegocioId          = negocioId,
            ClienteId          = clienteId,
            EmpleadoId         = empleadoId,
            ServicioId         = servicioId,
            Estado             = estado,
            Precio             = precio,
            InicioEn           = startOfMonth.AddDays(dia).AddHours(12),
            FinEn              = startOfMonth.AddDays(dia).AddHours(12).AddMinutes(30),
            FechaCreacion      = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        };
        db.Citas.AddRange(
            Nueva(EstadosCitas.Cancelada, 6, 400m),
            Nueva(EstadosCitas.Cancelada, 7, 400m),
            Nueva(EstadosCitas.Completada, 8, 500m));
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task ReportesCitas_ClienteEliminado_SusCitasSiguenContando()
    {
        var (negocioId, servicioId, empleadoId) = await SeedReportesDataAsync();
        await SeedCitasDeClienteEliminadoAsync(negocioId, servicioId, empleadoId);
        var client = NewClient(TestTokenHelper.Propietario(negocioId));

        var response = await client.GetAsync("/api/reportes/citas");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("totalCitas").GetInt32().Should().Be(8);
        body.GetProperty("totalCanceladas").GetInt32().Should().Be(3);
        body.GetProperty("totalCompletadas").GetInt32().Should().Be(4);
        body.GetProperty("totalIngresos").GetDecimal().Should().Be(1100.0m);
        body.GetProperty("citas").GetArrayLength().Should().Be(8);

        // The row stays, but the deleted client's contact data is not served again.
        var filasBorrado = body.GetProperty("citas").EnumerateArray()
            .Where(f => f.GetProperty("precio").GetDecimal() is 400m or 500m).ToList();
        filasBorrado.Should().HaveCount(3);
        filasBorrado.Should().OnlyContain(f =>
            f.GetProperty("nombreCliente").GetString() == "Cliente eliminado" &&
            f.GetProperty("telefonoCliente").GetString() == "" &&
            f.GetProperty("emailCliente").ValueKind == JsonValueKind.Null);
    }

    [Fact]
    public async Task ReportesCitas_ExportarCSV_ClienteEliminado_IncluyeSusCitas()
    {
        var (negocioId, servicioId, empleadoId) = await SeedReportesDataAsync();
        await SeedCitasDeClienteEliminadoAsync(negocioId, servicioId, empleadoId);
        var client = NewClient(TestTokenHelper.Propietario(negocioId));

        var csv = await client.GetStringAsync("/api/reportes/citas/exportar");

        var filas = csv.Split('\n', StringSplitOptions.RemoveEmptyEntries).Skip(1).ToList();
        filas.Should().HaveCount(8);
        csv.Should().Contain("Cliente eliminado").And.NotContain("borrado@test.com").And.NotContain("Cliente Borrado");
    }

    // One definition of "appointment" across screens (batch 1): Inicio's "Mes" leaves
    // out cancelled and no-show appointments, and Reportes says the same number as
    // TotalVigentes. TotalCitas keeps every row of the table, cancellations included.
    [Fact]
    public async Task ReportesCitas_TotalVigentes_CuadraConElMesDeInicio()
    {
        var (negocioId, servicioId, empleadoId) = await SeedReportesDataAsync();
        await SeedCitasDeClienteEliminadoAsync(negocioId, servicioId, empleadoId);
        var client = NewClient(TestTokenHelper.Propietario(negocioId));

        var reporte = await client.GetFromJsonAsync<JsonElement>("/api/reportes/citas");
        var resumen = await client.GetFromJsonAsync<JsonElement>("/api/dashboard/resumen");

        var vigentes = reporte.GetProperty("totalVigentes").GetInt32();
        vigentes.Should().Be(5);
        vigentes.Should().Be(resumen.GetProperty("citasMes").GetInt32());
        vigentes.Should().Be(reporte.GetProperty("totalCitas").GetInt32()
            - reporte.GetProperty("totalCanceladas").GetInt32()
            - reporte.GetProperty("totalInasistencias").GetInt32());
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
