using System.Net;
using System.Net.Http.Json;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Publico;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>
/// Public availability endpoints: the per-day one and the weekly one. Covers that
/// neither response is ever served from the output cache (a booking or a block must
/// show up on the next request) and the weekly endpoint's contract.
/// </summary>
public class DisponibilidadSemanaIntegrationTests : IntegrationTestBase
{
    public DisponibilidadSemanaIntegrationTests(CustomWebApplicationFactory factory)
        : base(factory) { }

    private sealed record DiaDto(string Fecha, string Estado, List<SlotDisponibleDto> Horarios);

    // Negocio in UTC, open 08:00-20:00 every day, one employee with the same schedule.
    private async Task<(Guid negocioId, Guid servicioId, Guid empleadoId)> SeedAsync(string zonaHoraria = "UTC")
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var negocioId  = Guid.NewGuid();
        var servicioId = Guid.NewGuid();
        var empleadoId = Guid.NewGuid();

        db.Negocios.Add(new Negocio
        {
            Id = negocioId, Slug = "disp-" + negocioId.ToString("N")[..8], Nombre = "Disp Salon",
            ZonaHoraria = zonaHoraria, AutoConfirmar = true, Activo = 1,
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        });
        db.Servicios.Add(new Servicio
        {
            Id = servicioId, NegocioId = negocioId, Nombre = "Corte",
            DuracionMinutos = 60, BufferMinutos = 0, Precio = 100m, Orden = 1, Activo = 1,
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        });
        db.Empleados.Add(new Empleado
        {
            Id = empleadoId, NegocioId = negocioId, Nombre = "Ana",
            Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        });
        db.EmpleadosServicios.Add(new EmpleadoServicio { EmpleadoId = empleadoId, ServicioId = servicioId });
        for (byte d = 0; d <= 6; d++)
        {
            db.HorariosNegocios.Add(new HorarioNegocio
            {
                Id = Guid.NewGuid(), NegocioId = negocioId, DiaSemana = d,
                HoraInicio = new TimeSpan(8, 0, 0), HoraFin = new TimeSpan(20, 0, 0), Activo = 1,
            });
            // Employee days use 1=Mon..7=Sun.
            db.HorariosEmpleados.Add(new HorarioEmpleado
            {
                Id = Guid.NewGuid(), EmpleadoId = empleadoId, DiaSemana = (byte)(d == 0 ? 7 : d),
                HoraInicio = new TimeSpan(8, 0, 0), HoraFin = new TimeSpan(20, 0, 0), Activo = 1,
            });
        }
        await db.SaveChangesAsync();
        return (negocioId, servicioId, empleadoId);
    }

    private async Task BloquearDiaAsync(Guid negocioId, DateTime fecha)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.BloqueosNegocio.Add(new BloqueoNegocio
        {
            Id = Guid.NewGuid(), NegocioId = negocioId, Fecha = fecha.Date, FechaCreacion = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
    }

    private static DateTime Manana => DateTime.UtcNow.Date.AddDays(1);

    // ── Output cache ──────────────────────────────────────────────────────────

    [Fact]
    public async Task DisponibilidadPorDia_TrasBloquearElDia_NoSirveRespuestaCacheada()
    {
        var (negocioId, servicioId, _) = await SeedAsync();
        var url = $"/api/publico/disponibilidad?servicioId={servicioId}&fecha={Manana:yyyy-MM-dd}";

        var antes = await NewClient().GetFromJsonAsync<List<SlotDisponibleDto>>(url);
        antes.Should().NotBeEmpty();

        await BloquearDiaAsync(negocioId, Manana);

        var despues = await NewClient().GetFromJsonAsync<List<SlotDisponibleDto>>(url);
        despues.Should().BeEmpty("a blocked day must show up on the very next request, not after the cache expires");
    }

    [Fact]
    public async Task DisponibilidadSemana_TrasBloquearUnDia_NoSirveRespuestaCacheada()
    {
        var (negocioId, servicioId, _) = await SeedAsync();
        var url = $"/api/publico/disponibilidad/semana?servicioId={servicioId}&desde={Manana:yyyy-MM-dd}&dias=3";

        var antes = await NewClient().GetFromJsonAsync<List<DiaDto>>(url);
        antes![0].Estado.Should().Be("con-horarios");

        await BloquearDiaAsync(negocioId, Manana);

        var despues = await NewClient().GetFromJsonAsync<List<DiaDto>>(url);
        despues![0].Estado.Should().Be("cerrado");
        despues[0].Horarios.Should().BeEmpty();
    }

    // ── Weekly endpoint contract ─────────────────────────────────────────────

    [Fact]
    public async Task DisponibilidadSemana_DevuelveUnDiaPorFechaConEstadoYHorarios()
    {
        var (negocioId, servicioId, empleadoId) = await SeedAsync();
        await BloquearDiaAsync(negocioId, Manana.AddDays(2));

        var response = await NewClient().GetAsync(
            $"/api/publico/disponibilidad/semana?servicioId={servicioId}&empleadoId={empleadoId}&desde={Manana:yyyy-MM-dd}&dias=7");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dias = await response.Content.ReadFromJsonAsync<List<DiaDto>>();
        dias.Should().HaveCount(7);
        dias!.Select(d => d.Fecha).Should().Equal(
            Enumerable.Range(0, 7).Select(i => Manana.AddDays(i).ToString("yyyy-MM-dd")));
        dias[2].Estado.Should().Be("cerrado");
        dias[2].Horarios.Should().BeEmpty();
        dias.Where((_, i) => i != 2).Should().OnlyContain(d => d.Estado == "con-horarios");
        // 08:00-20:00 with a 60-minute service = 12 slots, all for the chosen employee.
        dias[0].Horarios.Should().HaveCount(12)
            .And.OnlyContain(s => s.EmpleadoId == empleadoId && s.EmpleadoNombre == "Ana");
    }

    [Fact]
    public async Task DisponibilidadSemana_UsaElMismoJsonQueElEndpointPorDia()
    {
        var (_, servicioId, _) = await SeedAsync();
        var client = NewClient();

        var semana = await client.GetFromJsonAsync<List<DiaDto>>(
            $"/api/publico/disponibilidad/semana?servicioId={servicioId}&desde={Manana:yyyy-MM-dd}&dias=2");
        var porDia = await client.GetFromJsonAsync<List<SlotDisponibleDto>>(
            $"/api/publico/disponibilidad?servicioId={servicioId}&fecha={Manana.AddDays(1):yyyy-MM-dd}");

        semana![1].Horarios.Should().BeEquivalentTo(porDia, o => o.WithStrictOrdering());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(15)]
    [InlineData(-1)]
    public async Task DisponibilidadSemana_DiasFueraDeRango_Retorna400(int dias)
    {
        var (_, servicioId, _) = await SeedAsync();
        var response = await NewClient().GetAsync(
            $"/api/publico/disponibilidad/semana?servicioId={servicioId}&desde={Manana:yyyy-MM-dd}&dias={dias}");
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task DisponibilidadSemana_CatorceDias_EsElMaximoPermitido()
    {
        var (_, servicioId, _) = await SeedAsync();
        var dias = await NewClient().GetFromJsonAsync<List<DiaDto>>(
            $"/api/publico/disponibilidad/semana?servicioId={servicioId}&desde={Manana:yyyy-MM-dd}&dias=14");
        dias.Should().HaveCount(14);
    }

    [Fact]
    public async Task DisponibilidadSemana_FechaInvalida_Retorna400()
    {
        var (_, servicioId, _) = await SeedAsync();
        var response = await NewClient().GetAsync(
            $"/api/publico/disponibilidad/semana?servicioId={servicioId}&desde=29-10-2026");
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task DisponibilidadSemana_ServicioInexistente_Retorna404()
    {
        var response = await NewClient().GetAsync(
            $"/api/publico/disponibilidad/semana?servicioId={Guid.NewGuid()}&desde={Manana:yyyy-MM-dd}");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DisponibilidadSemana_DesdeEnElPasado_RecortaAHoyYConservaElFinDelRango()
    {
        var (_, servicioId, _) = await SeedAsync();
        var hoy = DateTime.UtcNow.Date; // business is in UTC
        var desde = hoy.AddDays(-3);

        var dias = await NewClient().GetFromJsonAsync<List<DiaDto>>(
            $"/api/publico/disponibilidad/semana?servicioId={servicioId}&desde={desde:yyyy-MM-dd}&dias=7");

        dias!.Select(d => d.Fecha).Should().Equal(
            Enumerable.Range(0, 4).Select(i => hoy.AddDays(i).ToString("yyyy-MM-dd")));
    }

    [Fact]
    public async Task DisponibilidadSemana_RangoCompletoEnElPasado_DevuelveListaVacia()
    {
        var (_, servicioId, _) = await SeedAsync();
        var desde = DateTime.UtcNow.Date.AddDays(-10);

        var dias = await NewClient().GetFromJsonAsync<List<DiaDto>>(
            $"/api/publico/disponibilidad/semana?servicioId={servicioId}&desde={desde:yyyy-MM-dd}&dias=7");

        dias.Should().BeEmpty();
    }

    // ── "Today" is the business's today, not the server's ─────────────────────

    // Kiritimati is UTC+14 and Pago Pago UTC-11: between them they are always on
    // different calendar days than UTC for part of the day, so the server clock
    // can never stand in for the business's date.
    [Theory]
    [InlineData("Pacific/Kiritimati")]
    [InlineData("Pacific/Pago_Pago")]
    public async Task DisponibilidadPorDia_HoyDelNegocio_SeAceptaYAyerSeRechaza(string zona)
    {
        var (_, servicioId, _) = await SeedAsync(zona);
        var hoyNegocio = TimeZoneInfo.ConvertTimeFromUtc(
            DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById(zona)).Date;
        var client = NewClient();

        var hoy = await client.GetAsync(
            $"/api/publico/disponibilidad?servicioId={servicioId}&fecha={hoyNegocio:yyyy-MM-dd}");
        var ayer = await client.GetAsync(
            $"/api/publico/disponibilidad?servicioId={servicioId}&fecha={hoyNegocio.AddDays(-1):yyyy-MM-dd}");

        hoy.StatusCode.Should().Be(HttpStatusCode.OK);
        ayer.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Theory]
    [InlineData("Pacific/Kiritimati")]
    [InlineData("Pacific/Pago_Pago")]
    public async Task DisponibilidadSemana_RecortaAlHoyDelNegocio(string zona)
    {
        var (_, servicioId, _) = await SeedAsync(zona);
        var hoyNegocio = TimeZoneInfo.ConvertTimeFromUtc(
            DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById(zona)).Date;

        var dias = await NewClient().GetFromJsonAsync<List<DiaDto>>(
            $"/api/publico/disponibilidad/semana?servicioId={servicioId}&desde={hoyNegocio.AddDays(-2):yyyy-MM-dd}&dias=7");

        dias![0].Fecha.Should().Be(hoyNegocio.ToString("yyyy-MM-dd"));
        dias.Should().HaveCount(5);
    }
}
