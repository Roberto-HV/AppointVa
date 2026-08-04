using System.Net;
using System.Net.Http.Json;
using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Pagos;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class CierreCajaControllerTests : IntegrationTestBase
{
    public CierreCajaControllerTests(CustomWebApplicationFactory factory) : base(factory) { }

    private async Task<(Guid negocioId, Guid citaId)> SeedAsync()
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var negocio = new Negocio
        {
            Id = Guid.NewGuid(),
            Nombre = "Test Caja",
            Slug = $"test-caja-{Guid.NewGuid().ToString("N")[..8]}",
            Activo = 1,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow
        };
        db.Negocios.Add(negocio);

        var servicio = new Servicio
        {
            Id = Guid.NewGuid(),
            NegocioId = negocio.Id,
            Nombre = "Corte",
            DuracionMinutos = 30,
            BufferMinutos = 0,
            Precio = 300m,
            Orden = 1,
            Activo = 1,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow
        };
        db.Servicios.Add(servicio);

        var empleado = new Empleado
        {
            Id = Guid.NewGuid(),
            NegocioId = negocio.Id,
            Nombre = "Empleado Test",
            Activo = 1,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow
        };
        db.Empleados.Add(empleado);

        var cliente = new Cliente
        {
            Id = Guid.NewGuid(),
            NegocioId = negocio.Id,
            NombreCompleto = "Cliente Test",
            Telefono = "1111111111",
            TotalCitas = 0,
            CantidadInasistencias = 0,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow
        };
        db.Clientes.Add(cliente);

        var hoy = DateTime.UtcNow.Date;
        var cita = new Cita
        {
            Id = Guid.NewGuid(),
            NegocioId = negocio.Id,
            ServicioId = servicio.Id,
            EmpleadoId = empleado.Id,
            ClienteId = cliente.Id,
            InicioEn = hoy.AddHours(10),
            FinEn = hoy.AddHours(10).AddMinutes(30),
            Estado = EstadosCitas.Completada,
            Precio = 300m,
            Pagada = true,
            MetodoPago = "Efectivo",
            MontoCobrado = 300m,
            FechaPago = hoy.AddHours(10).AddMinutes(30),
            CodigoConfirmacion = Guid.NewGuid().ToString("N")[..8].ToUpper(),
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow
        };
        db.Citas.Add(cita);
        await db.SaveChangesAsync();

        SetToken(TestTokenHelper.Propietario(negocio.Id));
        return (negocio.Id, cita.Id);
    }

    [Fact]
    public async Task Get_SinCierreExistente_RetornaVacioConEfectivoCobrado()
    {
        var (_, _) = await SeedAsync();
        var fecha = DateTime.UtcNow.Date.ToString("yyyy-MM-dd");

        var response = await Client.GetAsync($"api/cierre-caja?fecha={fecha}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var dto = await response.Content.ReadFromJsonAsync<CierreCajaDto>();
        dto!.EfectivoCobrado.Should().Be(300m);
        dto.EfectivoInicial.Should().Be(0m);
        dto.EfectivoContado.Should().Be(0m);
    }

    [Fact]
    public async Task Post_GuardaCierre_YGetLoRetorna()
    {
        var (_, _) = await SeedAsync();
        var fecha = DateTime.UtcNow.Date.ToString("yyyy-MM-dd");

        var payload = new GuardarCierreCajaDto
        {
            Fecha = fecha,
            EfectivoInicial = 500m,
            EfectivoContado = 750m,
            Retiros = new List<RetiroCajaDto>
            {
                new() { Concepto = "Renta", Monto = 100m }
            }
        };

        var postResponse = await Client.PostAsJsonAsync("api/cierre-caja", payload);
        postResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var saved = await postResponse.Content.ReadFromJsonAsync<CierreCajaDto>();
        saved!.EfectivoInicial.Should().Be(500m);
        saved.EfectivoContado.Should().Be(750m);
        saved.TotalRetiros.Should().Be(100m);
        // EfectivoEsperado = 500 + 300 (cobrado) - 100 (retiro) = 700
        saved.EfectivoEsperado.Should().Be(700m);
        // Diferencia = 750 - 700 = 50
        saved.Diferencia.Should().Be(50m);

        // Verify persistence via GET
        var getResponse = await Client.GetAsync($"api/cierre-caja?fecha={fecha}");
        var retrieved = await getResponse.Content.ReadFromJsonAsync<CierreCajaDto>();
        retrieved!.EfectivoInicial.Should().Be(500m);
        retrieved.Retiros.Should().HaveCount(1);
    }

    [Fact]
    public async Task Post_Empleado_Retorna403()
    {
        var (negocioId, _) = await SeedAsync();
        SetToken(TestTokenHelper.Empleado(negocioId));

        var payload = new GuardarCierreCajaDto
        {
            Fecha = DateTime.UtcNow.Date.ToString("yyyy-MM-dd"),
            EfectivoInicial = 0m,
            EfectivoContado = 0m
        };

        var response = await Client.PostAsJsonAsync("api/cierre-caja", payload);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
