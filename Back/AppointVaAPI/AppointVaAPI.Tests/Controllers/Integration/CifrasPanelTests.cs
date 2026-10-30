using System.Net;
using System.Net.Http.Json;
using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Citas;
using AppointVaAPI.Models.Dtos.Clientes;
using AppointVaAPI.Models.Dtos.Dashboard;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>
/// G3: una sola definición de "cita" para las cifras del panel. Las canceladas y
/// las inasistencias no cuentan en Inicio (Hoy/Semana/Mes) ni en Pagos (Por
/// cobrar, Citas pagadas x/y), y "Última visita" nunca es una fecha futura.
/// </summary>
public class CifrasPanelTests : IntegrationTestBase
{
    public CifrasPanelTests(CustomWebApplicationFactory factory) : base(factory) { }

    private sealed record Semilla(Guid NegocioId, Guid ClienteId);

    private sealed record CitaSemilla(DateTime InicioEn, byte Estado, decimal Precio, bool Pagada = false);

    private async Task<Semilla> SeedAsync(params CitaSemilla[] citas)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var ahora = DateTime.UtcNow;

        var negocio = new Negocio
        {
            Id                 = Guid.NewGuid(),
            Nombre             = "Test Cifras Panel",
            Slug               = $"test-cifras-{Guid.NewGuid().ToString("N")[..8]}",
            ZonaHoraria        = "UTC",
            Activo             = 1,
            FechaCreacion      = ahora,
            FechaActualizacion = ahora,
        };
        db.Negocios.Add(negocio);

        var servicio = new Servicio
        {
            Id                 = Guid.NewGuid(),
            NegocioId          = negocio.Id,
            Nombre             = "Corte",
            DuracionMinutos    = 30,
            BufferMinutos      = 0,
            Precio             = 100m,
            Orden              = 1,
            Activo             = 1,
            FechaCreacion      = ahora,
            FechaActualizacion = ahora,
        };
        db.Servicios.Add(servicio);

        var empleado = new Empleado
        {
            Id                 = Guid.NewGuid(),
            NegocioId          = negocio.Id,
            Nombre             = "Empleado Test",
            Activo             = 1,
            FechaCreacion      = ahora,
            FechaActualizacion = ahora,
        };
        db.Empleados.Add(empleado);

        var cliente = new Cliente
        {
            Id                    = Guid.NewGuid(),
            NegocioId             = negocio.Id,
            NombreCompleto        = "Cliente Cifras",
            Telefono              = "5512345678",
            TotalCitas            = citas.Length,
            CantidadInasistencias = 0,
            // Igual que al reservar: la última cita agendada, aunque sea futura.
            UltimaCitaEn          = citas.Length == 0 ? null : citas.Max(c => c.InicioEn),
            FechaCreacion         = ahora,
            FechaActualizacion    = ahora,
        };
        db.Clientes.Add(cliente);

        foreach (var c in citas)
        {
            db.Citas.Add(new Cita
            {
                Id                 = Guid.NewGuid(),
                NegocioId          = negocio.Id,
                ServicioId         = servicio.Id,
                EmpleadoId         = empleado.Id,
                ClienteId          = cliente.Id,
                InicioEn           = c.InicioEn,
                FinEn              = c.InicioEn.AddMinutes(30),
                Estado             = c.Estado,
                Precio             = c.Precio,
                Pagada             = c.Pagada,
                MetodoPago         = c.Pagada ? MetodosPago.Efectivo : null,
                MontoCobrado       = c.Pagada ? c.Precio : null,
                FechaPago          = c.Pagada ? c.InicioEn : null,
                CodigoConfirmacion = Guid.NewGuid().ToString("N")[..8].ToUpper(),
                FechaCreacion      = ahora,
                FechaActualizacion = ahora,
            });
        }

        await db.SaveChangesAsync();
        return new Semilla(negocio.Id, cliente.Id);
    }

    private HttpClient ClienteDe(Semilla s) => NewClient(TestTokenHelper.Propietario(s.NegocioId));

    // ── Inicio ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ResumenDashboard_NoCuentaCanceladasNiInasistencias()
    {
        // Mediodía UTC de hoy: dentro del día, la semana y el mes del servidor.
        var hoy = DateTime.UtcNow.Date.AddHours(12);
        var semilla = await SeedAsync(
            new CitaSemilla(hoy, EstadosCitas.Confirmada, 200m),
            new CitaSemilla(hoy.AddMinutes(30), EstadosCitas.Cancelada, 800m),
            new CitaSemilla(hoy.AddMinutes(60), EstadosCitas.Inasistencia, 300m),
            new CitaSemilla(hoy.AddMinutes(90), EstadosCitas.Completada, 150m));

        var response = await ClienteDe(semilla).GetAsync("/api/dashboard/resumen");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var resumen = (await response.Content.ReadFromJsonAsync<ResumenDashboardDto>())!;
        resumen.CitasHoy.Should().Be(2, "la cancelada y la inasistencia no son citas del día");
        resumen.CitasSemana.Should().Be(2);
        resumen.CitasMes.Should().Be(2);
    }

    [Fact]
    public async Task ResumenDashboard_UnaCitaCanceladaSolaDaHoyCero()
    {
        // El caso de la crítica: "Hoy 1" junto a "Sin citas para hoy".
        var semilla = await SeedAsync(
            new CitaSemilla(DateTime.UtcNow.Date.AddHours(12), EstadosCitas.Cancelada, 800m));

        var resumen = (await ClienteDe(semilla).GetFromJsonAsync<ResumenDashboardDto>("/api/dashboard/resumen"))!;

        resumen.CitasHoy.Should().Be(0);
    }

    [Fact]
    public async Task ResumenDashboard_SemanaYMesNoSumanReservasDePeriodosSiguientes()
    {
        var hoy = DateTime.UtcNow.Date.AddHours(12);
        var inicioMesSiguiente = new DateTime(hoy.Year, hoy.Month, 1, 12, 0, 0, DateTimeKind.Utc).AddMonths(1);
        var semilla = await SeedAsync(
            new CitaSemilla(hoy, EstadosCitas.Confirmada, 200m),
            new CitaSemilla(hoy.AddDays(8), EstadosCitas.Pendiente, 200m),      // semana siguiente
            new CitaSemilla(inicioMesSiguiente, EstadosCitas.Pendiente, 200m)); // mes siguiente

        var resumen = (await ClienteDe(semilla).GetFromJsonAsync<ResumenDashboardDto>("/api/dashboard/resumen"))!;

        // El día 1 del mes siguiente puede caer en esta misma semana (lunes a domingo).
        var dow = (int)hoy.DayOfWeek;
        var finSemana = hoy.Date.AddDays(dow == 0 ? -6 : -(dow - 1)).AddDays(7);
        var mesSiguienteEnEstaSemana = inicioMesSiguiente < finSemana ? 1 : 0;
        // Y dentro de 8 días puede seguir siendo este mes.
        var ochoDiasEnEsteMes = hoy.AddDays(8).Month == hoy.Month ? 1 : 0;

        resumen.CitasHoy.Should().Be(1);
        resumen.CitasSemana.Should().Be(1 + mesSiguienteEnEstaSemana, "una reserva de dentro de 8 días no es de esta semana");
        resumen.CitasMes.Should().Be(1 + ochoDiasEnEsteMes, "una reserva del mes siguiente no es de este mes");
    }

    // ── Pagos ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ResumenCobros_PorCobrarYCitasPagadasExcluyenCanceladasEInasistencias()
    {
        var dia = new DateTime(2026, 3, 10, 9, 0, 0, DateTimeKind.Utc);
        var semilla = await SeedAsync(
            new CitaSemilla(dia,                 EstadosCitas.Pendiente,    280m),
            new CitaSemilla(dia.AddMinutes(30),  EstadosCitas.Confirmada,   180m),
            new CitaSemilla(dia.AddMinutes(60),  EstadosCitas.Completada,   200m, Pagada: true),
            new CitaSemilla(dia.AddMinutes(90),  EstadosCitas.Cancelada,    800m),
            new CitaSemilla(dia.AddMinutes(120), EstadosCitas.Inasistencia, 300m));

        var rango = $"desde={dia.AddDays(-1):yyyy-MM-ddTHH:mm:ss}&hasta={dia.AddDays(1):yyyy-MM-ddTHH:mm:ss}";
        var response = await ClienteDe(semilla).GetAsync($"/api/citas/resumen-cobros?{rango}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var resumen = (await response.Content.ReadFromJsonAsync<ResumenCobrosDto>())!;
        resumen.TotalPendiente.Should().Be(460m, "solo 280 + 180 siguen por cobrar");
        resumen.TotalCitas.Should().Be(3);
        resumen.CitasPagadas.Should().Be(1);
        resumen.TotalCobrado.Should().Be(200m);
    }

    // ── Clientes ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Clientes_UltimaVisitaEsLaUltimaCompletadaYNuncaFutura()
    {
        var ahora = DateTime.UtcNow;
        var completada = ahora.AddDays(-10);
        var semilla = await SeedAsync(
            new CitaSemilla(completada,          EstadosCitas.Completada, 200m),
            new CitaSemilla(ahora.AddDays(-3),   EstadosCitas.Cancelada,  200m),
            new CitaSemilla(ahora.AddDays(-2),   EstadosCitas.Inasistencia, 200m),
            new CitaSemilla(ahora.AddDays(4),    EstadosCitas.Confirmada, 200m),
            // Marcada como completada por error antes de tiempo: tampoco es una visita.
            new CitaSemilla(ahora.AddDays(5),    EstadosCitas.Completada, 200m));

        var lista = (await ClienteDe(semilla).GetFromJsonAsync<List<ClienteDto>>("/api/clientes"))!;
        var cliente = lista.Should().ContainSingle().Subject;
        cliente.UltimaVisitaEn.Should().BeCloseTo(completada, TimeSpan.FromSeconds(1));
        cliente.UltimaVisitaEn.Should().BeBefore(ahora);
        // La última cita agendada sigue disponible para Activos/Inactivos.
        cliente.UltimaCitaEn.Should().BeAfter(ahora);

        var detalle = (await ClienteDe(semilla).GetFromJsonAsync<ClienteDto>($"/api/clientes/{semilla.ClienteId}"))!;
        detalle.UltimaVisitaEn.Should().BeCloseTo(completada, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task Clientes_SinCitasCompletadas_NoTieneUltimaVisita()
    {
        var semilla = await SeedAsync(
            new CitaSemilla(DateTime.UtcNow.AddDays(3), EstadosCitas.Pendiente, 200m));

        var lista = (await ClienteDe(semilla).GetFromJsonAsync<List<ClienteDto>>("/api/clientes"))!;

        lista.Should().ContainSingle().Which.UltimaVisitaEn.Should().BeNull();
    }
}
