using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AppointVaAPI.Constants;
using AppointVaAPI.Controllers.V1;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using FluentAssertions;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>
/// B18 / S7 (decision 10): exports with client data cover the whole directory, are
/// owner-only and rate limited, and every one writes an audit entry.
/// </summary>
public class ExportacionClientesTests : IntegrationTestBase
{
    public ExportacionClientesTests(CustomWebApplicationFactory factory) : base(factory) { }

    private async Task<Guid> SembrarAsync(int clientes, int citas = 0)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var negocio = new Negocio
        {
            Id = Guid.NewGuid(), Nombre = "Exportación", Slug = $"exp-{Guid.NewGuid():N}"[..20],
            ZonaHoraria = "UTC", Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        };
        db.Negocios.Add(negocio);
        var lista = Enumerable.Range(0, clientes).Select(i => new Cliente
        {
            Id = Guid.NewGuid(), NegocioId = negocio.Id, NombreCompleto = $"Cliente {i:D2}",
            Telefono = $"55{i:D8}", Email = $"c{i}@ejemplo.com", Notas = "nota interna",
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        }).ToList();
        db.Clientes.AddRange(lista);

        if (citas > 0)
        {
            var empleado = new Empleado
            {
                Id = Guid.NewGuid(), NegocioId = negocio.Id, Nombre = "Ana", Activo = 1,
                FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
            };
            var servicio = new Servicio
            {
                Id = Guid.NewGuid(), NegocioId = negocio.Id, Nombre = "Corte", DuracionMinutos = 30, Precio = 100,
                Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
            };
            db.Empleados.Add(empleado);
            db.Servicios.Add(servicio);
            for (var i = 0; i < citas; i++)
                db.Citas.Add(new Cita
                {
                    Id = Guid.NewGuid(), NegocioId = negocio.Id, ClienteId = lista[i % lista.Count].Id,
                    EmpleadoId = empleado.Id, ServicioId = servicio.Id, CodigoConfirmacion = $"EXP{i:D4}",
                    InicioEn = new DateTime(2026, 3, 10, 15, 0, 0, DateTimeKind.Utc).AddHours(i),
                    FinEn = new DateTime(2026, 3, 10, 15, 30, 0, DateTimeKind.Utc).AddHours(i),
                    Precio = 100, Estado = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
                });
        }

        await db.SaveChangesAsync();
        return negocio.Id;
    }

    private async Task<List<AuditLog>> ExportacionesAuditadasAsync(Guid usuarioId)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.AuditLogs
            .Where(a => a.UsuarioId == usuarioId && a.Accion == ClientesController.AccionExportarClientes)
            .ToListAsync();
    }

    [Fact]
    public async Task Exportar_Propietario_DevuelveTodoElDirectorioSinNotas_YAudita()
    {
        var negocioId = await SembrarAsync(clientes: 40);
        await SembrarAsync(clientes: 3); // another negocio: never leaks into the file
        var usuarioId = Guid.NewGuid();
        var cliente = NewClient(TestTokenHelper.GenerarToken("Propietario", negocioId, usuarioId));

        var resp = await cliente.GetAsync("/api/clientes/exportar");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var filas = await resp.Content.ReadFromJsonAsync<List<JsonElement>>();
        filas.Should().HaveCount(40);
        filas![0].GetProperty("nombreCompleto").GetString().Should().Be("Cliente 00");
        filas[0].TryGetProperty("notas", out _).Should().BeFalse();

        var auditoria = (await ExportacionesAuditadasAsync(usuarioId)).Should().ContainSingle().Subject;
        auditoria.EntidadId.Should().Be(negocioId.ToString());
        auditoria.Detalles.Should().Contain("Filas: 40").And.Contain("Formato: xlsx").And.Contain("directorio completo");
    }

    [Fact]
    public async Task Exportar_ConBusqueda_SoloLasCoincidencias()
    {
        var negocioId = await SembrarAsync(clientes: 12);
        var usuarioId = Guid.NewGuid();

        var filas = await NewClient(TestTokenHelper.GenerarToken("Propietario", negocioId, usuarioId))
            .GetFromJsonAsync<List<JsonElement>>("/api/clientes/exportar?buscar=cliente%201");

        filas.Should().HaveCount(2); // "Cliente 10", "Cliente 11"
        (await ExportacionesAuditadasAsync(usuarioId)).Single().Detalles.Should().Contain("Filas: 2");
    }

    [Fact]
    public async Task Exportar_Empleado_Retorna403_SinAuditoria()
    {
        var negocioId = await SembrarAsync(clientes: 2);
        var usuarioId = Guid.NewGuid();

        var resp = await NewClient(TestTokenHelper.GenerarToken("Empleado", negocioId, usuarioId))
            .GetAsync("/api/clientes/exportar");

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ExportacionesAuditadasAsync(usuarioId)).Should().BeEmpty();
    }

    // The "Testing" environment skips UseRateLimiter (Program.cs), so the limit is
    // checked on the endpoints' metadata: every client-data export carries it.
    [Theory]
    [InlineData(typeof(ClientesController), nameof(ClientesController.Exportar))]
    [InlineData(typeof(ReportesController), nameof(ReportesController.ExportacionCitas))]
    [InlineData(typeof(ReportesController), nameof(ReportesController.ExportarCitasCsv))]
    public void Exportaciones_LlevanElLimiteDeExportacion(Type controlador, string accion)
    {
        var atributo = controlador.GetMethod(accion)!
            .GetCustomAttributes(typeof(EnableRateLimitingAttribute), inherit: true)
            .Cast<EnableRateLimitingAttribute>().SingleOrDefault();

        atributo.Should().NotBeNull();
        atributo!.PolicyName.Should().Be(Politicas.LimiteExportacion);
    }

    [Fact]
    public async Task ReporteDeCitas_ExportacionExcelYCsv_QuedanAuditadas()
    {
        var negocioId = await SembrarAsync(clientes: 3, citas: 5);
        var usuarioId = Guid.NewGuid();
        var cliente = NewClient(TestTokenHelper.GenerarToken("Propietario", negocioId, usuarioId));
        const string rango = "desde=2026-03-01&hasta=2026-03-31";

        var excel = await cliente.GetFromJsonAsync<JsonElement>($"/api/reportes/citas/exportacion?{rango}");
        excel.GetProperty("citas").GetArrayLength().Should().Be(5);
        (await cliente.GetAsync($"/api/reportes/citas/exportar?{rango}")).StatusCode.Should().Be(HttpStatusCode.OK);
        // Viewing the report on screen is not an export.
        (await cliente.GetAsync($"/api/reportes/citas?{rango}")).StatusCode.Should().Be(HttpStatusCode.OK);

        var detalles = (await ExportacionesAuditadasAsync(usuarioId)).Select(a => a.Detalles).ToList();
        detalles.Should().HaveCount(2);
        detalles.Should().Contain(d => d!.Contains("reporte de citas") && d.Contains("Filas: 5") && d.Contains("Formato: xlsx"));
        detalles.Should().Contain(d => d!.Contains("Filas: 5") && d.Contains("Formato: csv"));
    }

    [Fact]
    public async Task ReporteDeCitas_Exportacion_Empleado403()
    {
        var resp = await NewClient(TestTokenHelper.Empleado(Guid.NewGuid()))
            .GetAsync("/api/reportes/citas/exportacion?desde=2026-03-01&hasta=2026-03-31");

        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}

/// <summary>S9: CSV cells that a spreadsheet would run as formulas.</summary>
public class EscaparCsvTests
{
    [Theory]
    [InlineData("=HYPERLINK(\"http://x\")", "\"'=HYPERLINK(\"\"http://x\"\")\"")]
    [InlineData("@SUMA(A1)", "'@SUMA(A1)")]
    [InlineData("-2+3+cmd|' /C calc'!A0", "'-2+3+cmd|' /C calc'!A0")]
    [InlineData("+cmd", "'+cmd")]
    [InlineData("+52 55 1234 5678", "+52 55 1234 5678")]
    [InlineData("-15", "-15")]
    [InlineData("Ana López", "Ana López")]
    [InlineData("", "")]
    public void Escapar_NeutralizaFormulas_SinTocarTelefonos(string entrada, string esperado)
    {
        ReportesController.Escapar(entrada).Should().Be(esperado);
    }
}
