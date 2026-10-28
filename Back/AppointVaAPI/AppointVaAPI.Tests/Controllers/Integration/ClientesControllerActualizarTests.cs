using System.Net;
using System.Net.Http.Json;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Clientes;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>PUT /api/clientes/{id}: edición del cliente desde el directorio.</summary>
public class ClientesControllerActualizarTests : IntegrationTestBase
{
    public ClientesControllerActualizarTests(CustomWebApplicationFactory factory) : base(factory) { }

    private sealed record Semilla(Guid NegocioId, Guid AnaId, Guid BetoId);

    private async Task<Semilla> SeedAsync()
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var negocio = new Negocio
        {
            Id                 = Guid.NewGuid(),
            Nombre             = "Test Editar Clientes",
            Slug               = $"test-editar-{Guid.NewGuid().ToString("N")[..8]}",
            ZonaHoraria        = "UTC",
            Activo             = 1,
            FechaCreacion      = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        };
        db.Negocios.Add(negocio);

        Cliente Nuevo(string nombre, string telefono, string? email) => new()
        {
            Id                    = Guid.NewGuid(),
            NegocioId             = negocio.Id,
            NombreCompleto        = nombre,
            Telefono              = telefono,
            Email                 = email,
            TotalCitas            = 0,
            CantidadInasistencias = 0,
            FechaCreacion         = DateTime.UtcNow,
            FechaActualizacion    = DateTime.UtcNow,
        };

        var ana = Nuevo("Ana Pérez", "5511112222", "ana@correo.com");
        var beto = Nuevo("Beto Ruiz", "5533334444", "beto@correo.com");
        db.Clientes.AddRange(ana, beto);
        await db.SaveChangesAsync();
        return new Semilla(negocio.Id, ana.Id, beto.Id);
    }

    private HttpClient Propietario(Semilla s) => NewClient(TestTokenHelper.Propietario(s.NegocioId));

    private async Task<Cliente> LeerAsync(Guid id)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.Clientes.AsNoTracking().SingleAsync(c => c.Id == id);
    }

    [Fact]
    public async Task Actualizar_ConPropietario_GuardaDatosYNormalizaTelefono()
    {
        var s = await SeedAsync();

        var response = await Propietario(s).PutAsJsonAsync($"/api/clientes/{s.AnaId}", new
        {
            nombreCompleto = "  Ana María Pérez ",
            telefono = "55 1111-9999",
            email = "ana.maria@correo.com",
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<ClienteDto>();
        dto!.NombreCompleto.Should().Be("Ana María Pérez");
        dto.Telefono.Should().Be("5511119999");

        var guardado = await LeerAsync(s.AnaId);
        guardado.NombreCompleto.Should().Be("Ana María Pérez");
        guardado.Telefono.Should().Be("5511119999");
        guardado.Email.Should().Be("ana.maria@correo.com");
    }

    [Fact]
    public async Task Actualizar_SinTelefonoNiCorreo_LosDejaVacios()
    {
        var s = await SeedAsync();

        var response = await Propietario(s).PutAsJsonAsync($"/api/clientes/{s.AnaId}", new
        {
            nombreCompleto = "Ana Pérez",
            telefono = "",
            email = "",
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var guardado = await LeerAsync(s.AnaId);
        guardado.Telefono.Should().BeNull();
        guardado.Email.Should().BeNull();
    }

    [Fact]
    public async Task Actualizar_ConTelefonoDeOtroCliente_Retorna409()
    {
        var s = await SeedAsync();

        var response = await Propietario(s).PutAsJsonAsync($"/api/clientes/{s.AnaId}", new
        {
            nombreCompleto = "Ana Pérez",
            telefono = "(55) 3333-4444",
            email = "ana@correo.com",
        });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await LeerAsync(s.AnaId)).Telefono.Should().Be("5511112222");
    }

    [Fact]
    public async Task Actualizar_ConCorreoDeOtroCliente_Retorna409()
    {
        var s = await SeedAsync();

        var response = await Propietario(s).PutAsJsonAsync($"/api/clientes/{s.AnaId}", new
        {
            nombreCompleto = "Ana Pérez",
            telefono = "5511112222",
            email = "BETO@correo.com",
        });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Actualizar_ConservandoSuPropioTelefono_Retorna200()
    {
        var s = await SeedAsync();

        var response = await Propietario(s).PutAsJsonAsync($"/api/clientes/{s.AnaId}", new
        {
            nombreCompleto = "Ana P.",
            telefono = "5511112222",
            email = "ana@correo.com",
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Theory]
    [InlineData("", "5511112222", "ana@correo.com")]
    [InlineData("Ana", "123", "ana@correo.com")]
    [InlineData("Ana", "5511112222", "no-es-correo")]
    public async Task Actualizar_ConDatosInvalidos_Retorna400(string nombre, string telefono, string email)
    {
        var s = await SeedAsync();

        var response = await Propietario(s).PutAsJsonAsync($"/api/clientes/{s.AnaId}", new
        {
            nombreCompleto = nombre,
            telefono,
            email,
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Actualizar_ClienteDeOtroNegocio_Retorna404()
    {
        var s = await SeedAsync();
        var otro = await SeedAsync();

        var response = await Propietario(s).PutAsJsonAsync($"/api/clientes/{otro.AnaId}", new
        {
            nombreCompleto = "Intruso",
            telefono = "5599990000",
            email = "",
        });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await LeerAsync(otro.AnaId)).NombreCompleto.Should().Be("Ana Pérez");
    }

    [Fact]
    public async Task Actualizar_ConEmpleado_Retorna403()
    {
        var s = await SeedAsync();

        var response = await NewClient(TestTokenHelper.Empleado(s.NegocioId))
            .PutAsJsonAsync($"/api/clientes/{s.AnaId}", new { nombreCompleto = "X", telefono = "", email = "" });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
