using System.Net;
using System.Net.Http.Json;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Clientes;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>
/// Filtro de actividad en GET /api/clientes y conteos de GET /api/clientes/resumen-actividad.
/// </summary>
public class ClientesControllerActividadTests : IntegrationTestBase
{
    public ClientesControllerActividadTests(CustomWebApplicationFactory factory) : base(factory) { }

    private sealed record Semilla(Guid NegocioId);

    /// <param name="clientes">
    /// Por cada cliente: nombre y la fecha de su última cita agendada, o null si
    /// nunca se le agendó una.
    /// </param>
    private async Task<Semilla> SeedAsync(params (string Nombre, DateTime? UltimaCitaEn)[] clientes)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var negocio = new Negocio
        {
            Id                 = Guid.NewGuid(),
            Nombre             = "Test Actividad Clientes",
            Slug               = $"test-actividad-{Guid.NewGuid().ToString("N")[..8]}",
            ZonaHoraria        = "UTC",
            Activo             = 1,
            FechaCreacion      = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        };
        db.Negocios.Add(negocio);

        var n = 0;
        foreach (var (nombre, ultimaCitaEn) in clientes)
        {
            db.Clientes.Add(new Cliente
            {
                Id                    = Guid.NewGuid(),
                NegocioId             = negocio.Id,
                NombreCompleto        = nombre,
                Telefono              = $"55{n:D8}",
                TotalCitas            = ultimaCitaEn is null ? 0 : 1,
                CantidadInasistencias = 0,
                UltimaCitaEn          = ultimaCitaEn,
                FechaCreacion         = DateTime.UtcNow,
                FechaActualizacion    = DateTime.UtcNow,
            });
            n++;
        }

        await db.SaveChangesAsync();
        return new Semilla(negocio.Id);
    }

    private HttpClient ClienteDe(Semilla semilla) =>
        NewClient(TestTokenHelper.Propietario(semilla.NegocioId));

    private static DateTime HaceDias(double dias) => DateTime.UtcNow.AddDays(-dias);

    private async Task<List<ClienteDto>> ListarAsync(Semilla semilla, string query)
    {
        var response = await ClienteDe(semilla).GetAsync($"/api/clientes?{query}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return await response.Content.ReadFromJsonAsync<List<ClienteDto>>() ?? new();
    }

    private async Task<ResumenActividadDto> ResumenAsync(Semilla semilla, string query)
    {
        var response = await ClienteDe(semilla).GetAsync($"/api/clientes/resumen-actividad?{query}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<ResumenActividadDto>())!;
    }

    // ── Los tres grupos ───────────────────────────────────────────────────────

    private Task<Semilla> SeedTresGruposAsync() => SeedAsync(
        ("Ana Reciente",   HaceDias(10)),
        ("Beto Agendado",  HaceDias(-5)),   // cita reservada para dentro de 5 días
        ("Carla Olvidada", HaceDias(200)),
        ("Diego Nunca",    null));

    [Fact]
    public async Task Listar_ConActividadActivos_SoloDevuelveLosDelUmbral()
    {
        var semilla = await SeedTresGruposAsync();

        var clientes = await ListarAsync(semilla, "actividad=activos&dias=60");

        clientes.Select(c => c.NombreCompleto)
            .Should().BeEquivalentTo("Ana Reciente", "Beto Agendado");
    }

    [Fact]
    public async Task Listar_ConActividadInactivos_SoloDevuelveLosDeFueraDelUmbral()
    {
        var semilla = await SeedTresGruposAsync();

        var clientes = await ListarAsync(semilla, "actividad=inactivos&dias=60");

        clientes.Should().ContainSingle().Which.NombreCompleto.Should().Be("Carla Olvidada");
    }

    [Fact]
    public async Task Listar_ConActividad_NuncaDevuelveAQuienJamasAgendo()
    {
        var semilla = await SeedTresGruposAsync();

        var activos   = await ListarAsync(semilla, "actividad=activos&dias=60");
        var inactivos = await ListarAsync(semilla, "actividad=inactivos&dias=60");

        activos.Should().NotContain(c => c.NombreCompleto == "Diego Nunca");
        inactivos.Should().NotContain(c => c.NombreCompleto == "Diego Nunca");
    }

    [Fact]
    public async Task Listar_ConActividadActivos_IncluyeCitaFutura()
    {
        // UltimaCitaEn guarda el inicio de la última cita agendada, no la última
        // visita: quien ya reservó para la semana que entra sigue siendo activo.
        var semilla = await SeedAsync(("Beto Agendado", HaceDias(-5)));

        var clientes = await ListarAsync(semilla, "actividad=activos&dias=60");

        clientes.Should().ContainSingle().Which.NombreCompleto.Should().Be("Beto Agendado");
    }

    // ── Frontera del umbral ───────────────────────────────────────────────────

    [Fact]
    public async Task Listar_JustoSobreElCorte_CuentaComoActivo()
    {
        // El corte es relativo al instante de la petición, así que la semilla lleva
        // 30 s de margen: lo que se fija aquí es que la frontera está en 60 días
        // exactos y que caer sobre ella cuenta como activo, no como inactivo.
        var semilla = await SeedAsync(("Justo En El Corte", HaceDias(60).AddSeconds(30)));

        var activos   = await ListarAsync(semilla, "actividad=activos&dias=60");
        var inactivos = await ListarAsync(semilla, "actividad=inactivos&dias=60");

        activos.Should().ContainSingle().Which.NombreCompleto.Should().Be("Justo En El Corte");
        inactivos.Should().BeEmpty();
    }

    [Fact]
    public async Task Listar_UnPasoAntesDelCorte_CuentaComoInactivo()
    {
        var semilla = await SeedAsync(("Apenas Fuera", HaceDias(60).AddSeconds(-30)));

        var activos   = await ListarAsync(semilla, "actividad=activos&dias=60");
        var inactivos = await ListarAsync(semilla, "actividad=inactivos&dias=60");

        activos.Should().BeEmpty();
        inactivos.Should().ContainSingle().Which.NombreCompleto.Should().Be("Apenas Fuera");
    }

    [Fact]
    public async Task Listar_ElUmbralMueveLaFrontera()
    {
        var semilla = await SeedAsync(("Carla Olvidada", HaceDias(100)));

        var con60  = await ListarAsync(semilla, "actividad=inactivos&dias=60");
        var con180 = await ListarAsync(semilla, "actividad=inactivos&dias=180");

        con60.Should().ContainSingle();
        con180.Should().BeEmpty();
    }

    [Fact]
    public async Task Listar_SinDias_UsaElUmbralPorDefectoDe60()
    {
        var semilla = await SeedAsync(
            ("Dentro De 60", HaceDias(30)),
            ("Fuera De 60",  HaceDias(90)));

        var inactivos = await ListarAsync(semilla, "actividad=inactivos");

        inactivos.Should().ContainSingle().Which.NombreCompleto.Should().Be("Fuera De 60");
    }

    // ── Orden ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Listar_Inactivos_OrdenaDelMasAbandonadoAlMenos()
    {
        // Es una lista de a quién llamar: el que lleva más tiempo sin volver va primero.
        var semilla = await SeedAsync(
            ("Media",  HaceDias(120)),
            ("Vieja",  HaceDias(300)),
            ("Nueva",  HaceDias(70)));

        var inactivos = await ListarAsync(semilla, "actividad=inactivos&dias=60");

        inactivos.Select(c => c.NombreCompleto).Should().ContainInOrder("Vieja", "Media", "Nueva");
    }

    [Fact]
    public async Task Listar_Activos_OrdenaDelMasRecienteAlMasAntiguo()
    {
        var semilla = await SeedAsync(
            ("Media",  HaceDias(20)),
            ("Vieja",  HaceDias(50)),
            ("Nueva",  HaceDias(1)));

        var activos = await ListarAsync(semilla, "actividad=activos&dias=60");

        activos.Select(c => c.NombreCompleto).Should().ContainInOrder("Nueva", "Media", "Vieja");
    }

    // ── El parámetro es opcional ──────────────────────────────────────────────

    [Fact]
    public async Task Listar_SinActividad_DevuelveElDirectorioCompletoPorNombre()
    {
        var semilla = await SeedTresGruposAsync();

        var response = await ClienteDe(semilla).GetAsync("/api/clientes");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var clientes = await response.Content.ReadFromJsonAsync<List<ClienteDto>>() ?? new();
        clientes.Select(c => c.NombreCompleto)
            .Should().ContainInOrder("Ana Reciente", "Beto Agendado", "Carla Olvidada", "Diego Nunca");
        response.Headers.GetValues("X-Total-Count").Single().Should().Be("4");
    }

    [Fact]
    public async Task Listar_SinActividadPeroConBuscar_SigueBuscandoIgual()
    {
        var semilla = await SeedTresGruposAsync();

        var clientes = await ListarAsync(semilla, "buscar=carla");

        clientes.Should().ContainSingle().Which.NombreCompleto.Should().Be("Carla Olvidada");
    }

    [Fact]
    public async Task Listar_ConActividadDesconocida_Retorna400()
    {
        var semilla = await SeedTresGruposAsync();

        var response = await ClienteDe(semilla).GetAsync("/api/clientes?actividad=zombis");

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Listar_ConDiasNoPositivos_Retorna400()
    {
        var semilla = await SeedTresGruposAsync();

        var response = await ClienteDe(semilla).GetAsync("/api/clientes?actividad=activos&dias=0");

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── Resumen ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Resumen_ReparteElDirectorioEnTresGrupos()
    {
        var semilla = await SeedTresGruposAsync();

        var resumen = await ResumenAsync(semilla, "dias=60");

        resumen.Total.Should().Be(4);
        resumen.Activos.Should().Be(2);
        resumen.Inactivos.Should().Be(1);
        resumen.SinVisitas.Should().Be(1);
    }

    [Fact]
    public async Task Resumen_LosTresGruposSiempreSumanElTotal()
    {
        var semilla = await SeedTresGruposAsync();

        var resumen = await ResumenAsync(semilla, "dias=90");

        (resumen.Activos + resumen.Inactivos + resumen.SinVisitas).Should().Be(resumen.Total);
    }

    [Fact]
    public async Task Resumen_SinToken_Retorna401()
    {
        var response = await NewClient().GetAsync("/api/clientes/resumen-actividad");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Sin tope de 500 ───────────────────────────────────────────────────────

    /// <summary>
    /// 600 clientes ordenados por nombre. "Cliente 550" es el único inactivo y el
    /// único sin visitas está en 560: ambos quedan fuera de las primeras 500 filas,
    /// que era todo lo que el análisis veía antes.
    /// </summary>
    private Task<Semilla> SeedSeiscientosAsync() => SeedAsync(
        Enumerable.Range(0, 600)
            .Select(i => (
                $"Cliente {i:D3}",
                i == 550 ? HaceDias(200) : i == 560 ? (DateTime?)null : HaceDias(5)))
            .ToArray());

    [Fact]
    public async Task Listar_Inactivos_EncuentraAlClienteMasAllaDeLaPosicion500()
    {
        var semilla = await SeedSeiscientosAsync();

        var inactivos = await ListarAsync(semilla, "actividad=inactivos&dias=60&pagina=1&tamano=15");

        inactivos.Should().ContainSingle().Which.NombreCompleto.Should().Be("Cliente 550");
    }

    [Fact]
    public async Task Resumen_ConMasDe500Clientes_CuentaElDirectorioCompleto()
    {
        var semilla = await SeedSeiscientosAsync();

        var resumen = await ResumenAsync(semilla, "dias=60");

        resumen.Total.Should().Be(600);
        resumen.Activos.Should().Be(598);
        resumen.Inactivos.Should().Be(1);
        resumen.SinVisitas.Should().Be(1);
    }

    [Fact]
    public async Task Resumen_NoDependeDelTamanoDePagina()
    {
        var semilla = await SeedSeiscientosAsync();

        var resumen = await ResumenAsync(semilla, "dias=60");
        var pagina = await ClienteDe(semilla)
            .GetAsync("/api/clientes?actividad=activos&dias=60&pagina=1&tamano=15");
        var filas = await pagina.Content.ReadFromJsonAsync<List<ClienteDto>>() ?? new();

        filas.Should().HaveCount(15);
        pagina.Headers.GetValues("X-Total-Count").Single().Should().Be("598");
        resumen.Activos.Should().Be(598);
    }

    [Fact]
    public async Task Listar_ConActividadYPaginacion_TotalCountReflejaElGrupo()
    {
        var semilla = await SeedSeiscientosAsync();

        var response = await ClienteDe(semilla)
            .GetAsync("/api/clientes?actividad=inactivos&dias=60&pagina=1&tamano=15");

        response.Headers.GetValues("X-Total-Count").Single().Should().Be("1");
    }
}
