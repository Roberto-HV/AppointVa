using System.Net.Http.Headers;
using System.Net.Http.Json;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Negocios;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class NegocioAnticipoTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public NegocioAnticipoTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task SeedNegocioAsync(Guid negocioId)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var negocio = new Negocio
        {
            Id = negocioId,
            Nombre = "Test Negocio",
            Slug = $"test-negocio-{Guid.NewGuid().ToString("N")[..8]}",
            Activo = 1,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow
        };
        db.Negocios.Add(negocio);
        await db.SaveChangesAsync();
    }

    private HttpClient CreateAuthenticatedClient(string token)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    [Fact]
    public async Task ActualizarPerfil_NuevosCamposAnticipo_GuardaYDevuelveCorrectamente()
    {
        // Arrange
        var negocioId = Guid.NewGuid();
        var token = TestTokenHelper.Propietario(negocioId);
        var client = CreateAuthenticatedClient(token);
        await SeedNegocioAsync(negocioId);

        var dto = new
        {
            Nombre = "Salon Test",
            PorcentajeAnticipo = 30,
            HorasCancelacionConReembolso = 48,
            PoliticaCancelacionAnticipo = "Sin reembolso después de 48 horas."
        };

        // Act
        var response = await client.PutAsJsonAsync("/api/negocios/perfil", dto);

        // Assert
        response.EnsureSuccessStatusCode();
        var negocio = await response.Content.ReadFromJsonAsync<NegocioDto>();
        Assert.NotNull(negocio);
        Assert.Equal(30, negocio!.PorcentajeAnticipo);
        Assert.Equal(48, negocio.HorasCancelacionConReembolso);
        Assert.Equal("Sin reembolso después de 48 horas.", negocio.PoliticaCancelacionAnticipo);
    }

    [Fact]
    public async Task ActualizarPerfil_PorcentajeFueraDe80_DevuelveBadRequest()
    {
        // Arrange
        var negocioId = Guid.NewGuid();
        var token = TestTokenHelper.Propietario(negocioId);
        var client = CreateAuthenticatedClient(token);
        await SeedNegocioAsync(negocioId);

        var dto = new { Nombre = "Salon Test", PorcentajeAnticipo = 90 };

        // Act
        var response = await client.PutAsJsonAsync("/api/negocios/perfil", dto);

        // Assert
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, response.StatusCode);
    }
}
