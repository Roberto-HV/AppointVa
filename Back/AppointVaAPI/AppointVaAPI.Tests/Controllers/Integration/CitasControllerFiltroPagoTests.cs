using System.Net;
using System.Net.Http.Json;
using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Citas;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>
/// Filtro por estado de pago en GET /api/citas y totales de GET /api/citas/resumen-cobros.
/// </summary>
public class CitasControllerFiltroPagoTests : IntegrationTestBase
{
    public CitasControllerFiltroPagoTests(CustomWebApplicationFactory factory) : base(factory) { }

    private static readonly DateTime Inicio = new(2026, 3, 10, 9, 0, 0, DateTimeKind.Utc);

    private sealed record Semilla(Guid NegocioId, Guid EmpleadoId);

    /// <param name="citas">Por cada cita: nombre del cliente, si está pagada y el precio.</param>
    private async Task<Semilla> SeedAsync(params (string Cliente, bool Pagada, decimal Precio)[] citas)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var negocio = new Negocio
        {
            Id                 = Guid.NewGuid(),
            Nombre             = "Test Filtro Pago",
            Slug               = $"test-filtro-pago-{Guid.NewGuid().ToString("N")[..8]}",
            ZonaHoraria        = "UTC",
            Activo             = 1,
            FechaCreacion      = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        };
        db.Negocios.Add(negocio);

        var servicio = new Servicio
        {
            Id                 = Guid.NewGuid(),
            NegocioId          = negocio.Id,
            Nombre             = "Corte",
            DuracionMinutos    = 30,
            BufferMinutos      = 0,
            Precio             = 200m,
            Orden              = 1,
            Activo             = 1,
            FechaCreacion      = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        };
        db.Servicios.Add(servicio);

        var empleado = new Empleado
        {
            Id                 = Guid.NewGuid(),
            NegocioId          = negocio.Id,
            Nombre             = "Empleado Test",
            Activo             = 1,
            FechaCreacion      = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        };
        db.Empleados.Add(empleado);

        var minuto = 0;
        foreach (var (nombreCliente, pagada, precio) in citas)
        {
            var cliente = new Cliente
            {
                Id                    = Guid.NewGuid(),
                NegocioId             = negocio.Id,
                NombreCompleto        = nombreCliente,
                Telefono              = $"55{minuto:D8}",
                TotalCitas            = 0,
                CantidadInasistencias = 0,
                FechaCreacion         = DateTime.UtcNow,
                FechaActualizacion    = DateTime.UtcNow,
            };
            db.Clientes.Add(cliente);

            var inicioEn = Inicio.AddMinutes(minuto);
            db.Citas.Add(new Cita
            {
                Id                 = Guid.NewGuid(),
                NegocioId          = negocio.Id,
                ServicioId         = servicio.Id,
                EmpleadoId         = empleado.Id,
                ClienteId          = cliente.Id,
                InicioEn           = inicioEn,
                FinEn              = inicioEn.AddMinutes(30),
                Estado             = EstadosCitas.Completada,
                Precio             = precio,
                Pagada             = pagada,
                MetodoPago         = pagada ? MetodosPago.Efectivo : null,
                MontoCobrado       = pagada ? precio : null,
                FechaPago          = pagada ? inicioEn : null,
                CodigoConfirmacion = Guid.NewGuid().ToString("N")[..8].ToUpper(),
                FechaCreacion      = DateTime.UtcNow,
                FechaActualizacion = DateTime.UtcNow,
            });
            minuto++;
        }

        await db.SaveChangesAsync();
        return new Semilla(negocio.Id, empleado.Id);
    }

    private HttpClient ClienteDe(Semilla semilla) =>
        NewClient(TestTokenHelper.Propietario(semilla.NegocioId));

    private static string RangoCompleto =>
        $"desde={Inicio.AddDays(-1):yyyy-MM-ddTHH:mm:ss}&hasta={Inicio.AddDays(1):yyyy-MM-ddTHH:mm:ss}";

    [Fact]
    public async Task Listar_SinPagada_DevuelveTodasLasCitas()
    {
        var semilla = await SeedAsync(
            ("Ana Pendiente", false, 100m),
            ("Beto Pagado",   true,  200m),
            ("Carla Pendiente", false, 300m));

        var response = await ClienteDe(semilla).GetAsync($"/api/citas?{RangoCompleto}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var citas = await response.Content.ReadFromJsonAsync<List<CitaDto>>();
        citas!.Should().HaveCount(3);
        response.Headers.GetValues("X-Total-Count").Single().Should().Be("3");
    }

    [Fact]
    public async Task Listar_ConPagadaTrue_DevuelveSoloPagadas()
    {
        var semilla = await SeedAsync(
            ("Ana Pendiente", false, 100m),
            ("Beto Pagado",   true,  200m),
            ("Carla Pendiente", false, 300m));

        var response = await ClienteDe(semilla).GetAsync($"/api/citas?{RangoCompleto}&pagada=true");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var citas = await response.Content.ReadFromJsonAsync<List<CitaDto>>() ?? new();
        citas.Should().HaveCount(1);
        citas[0].NombreCliente.Should().Be("Beto Pagado");
        response.Headers.GetValues("X-Total-Count").Single().Should().Be("1");
    }

    [Fact]
    public async Task Listar_ConPagadaFalse_DevuelveSoloPendientes()
    {
        var semilla = await SeedAsync(
            ("Ana Pendiente", false, 100m),
            ("Beto Pagado",   true,  200m),
            ("Carla Pendiente", false, 300m));

        var response = await ClienteDe(semilla).GetAsync($"/api/citas?{RangoCompleto}&pagada=false");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var citas = await response.Content.ReadFromJsonAsync<List<CitaDto>>() ?? new();
        citas.Should().HaveCount(2);
        citas.Select(c => c.NombreCliente).Should().BeEquivalentTo("Ana Pendiente", "Carla Pendiente");
        response.Headers.GetValues("X-Total-Count").Single().Should().Be("2");
    }

    [Fact]
    public async Task Listar_ConBusqueda_EncuentraCitaMasAllaDeLaPrimeraPagina()
    {
        // El bug original: el panel traía 200 filas y buscaba en memoria, así que
        // un cliente en la posición 250 era invisible. La búsqueda va al servidor.
        var citas = Enumerable.Range(0, 260)
            .Select(i => ($"Cliente {i:D3}", i % 2 == 0, 100m))
            .ToArray();
        var semilla = await SeedAsync(citas);

        var response = await ClienteDe(semilla)
            .GetAsync($"/api/citas?{RangoCompleto}&busqueda=Cliente%20250&pagina=1&tamano=50");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var resultado = await response.Content.ReadFromJsonAsync<List<CitaDto>>();
        resultado!.Should().ContainSingle()
            .Which.NombreCliente.Should().Be("Cliente 250");
    }

    [Fact]
    public async Task Listar_ConPagadaYPaginacion_TotalCountReflejaElFiltro()
    {
        var citas = Enumerable.Range(0, 260)
            .Select(i => ($"Cliente {i:D3}", i % 2 == 0, 100m))
            .ToArray();
        var semilla = await SeedAsync(citas);

        var response = await ClienteDe(semilla)
            .GetAsync($"/api/citas?{RangoCompleto}&pagada=false&pagina=1&tamano=50");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var resultado = await response.Content.ReadFromJsonAsync<List<CitaDto>>();
        resultado!.Should().HaveCount(50);
        response.Headers.GetValues("X-Total-Count").Single().Should().Be("130");
        resultado.Should().OnlyContain(c => !c.Pagada);
    }

    [Fact]
    public async Task ResumenCobros_DevuelveTotalesDelPeriodoCompleto()
    {
        var semilla = await SeedAsync(
            ("Ana Pendiente",  false, 100m),
            ("Beto Pagado",    true,  200m),
            ("Carla Pendiente", false, 300m),
            ("Dora Pagada",    true,  50m));

        var response = await ClienteDe(semilla)
            .GetAsync($"/api/citas/resumen-cobros?{RangoCompleto}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var resumen = await response.Content.ReadFromJsonAsync<ResumenCobrosDto>();
        resumen!.TotalCitas.Should().Be(4);
        resumen.CitasPagadas.Should().Be(2);
        resumen.TotalCobrado.Should().Be(250m);
        resumen.TotalPendiente.Should().Be(400m);
        resumen.Desglose.Single(d => d.Metodo == MetodosPago.Efectivo).Monto.Should().Be(250m);
        resumen.Desglose.Single(d => d.Metodo == MetodosPago.Efectivo).Cantidad.Should().Be(2);
    }

    [Fact]
    public async Task ResumenCobros_ConMasDe200Citas_NoDependeDelTamanoDePagina()
    {
        // 260 citas: los KPIs del tab de cobro se leen de aquí, no de la página visible.
        var citas = Enumerable.Range(0, 260)
            .Select(i => ($"Cliente {i:D3}", i % 2 == 0, 100m))
            .ToArray();
        var semilla = await SeedAsync(citas);

        var response = await ClienteDe(semilla)
            .GetAsync($"/api/citas/resumen-cobros?{RangoCompleto}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var resumen = await response.Content.ReadFromJsonAsync<ResumenCobrosDto>();
        resumen!.TotalCitas.Should().Be(260);
        resumen.CitasPagadas.Should().Be(130);
        resumen.TotalCobrado.Should().Be(13_000m);
        resumen.TotalPendiente.Should().Be(13_000m);
    }

    [Fact]
    public async Task ResumenCobros_SinToken_Retorna401()
    {
        var client = NewClient();

        var response = await client.GetAsync("/api/citas/resumen-cobros");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
