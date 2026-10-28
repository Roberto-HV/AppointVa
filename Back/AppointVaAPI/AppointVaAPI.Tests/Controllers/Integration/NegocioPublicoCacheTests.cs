using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>
/// The public business page is the only endpoint served from the output cache
/// ("NegocioPublico" policy). These tests pin that it is actually cached, that the
/// owner's edits evict it by tag, and that authenticated requests bypass the cache.
/// </summary>
public class NegocioPublicoCacheTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public NegocioPublicoCacheTests(CustomWebApplicationFactory factory) => _factory = factory;

    private async Task<string> SeedNegocioAsync(Guid negocioId, string nombre)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var slug = $"cache-{Guid.NewGuid().ToString("N")[..8]}";
        db.Negocios.Add(new Negocio
        {
            Id = negocioId,
            Nombre = nombre,
            Slug = slug,
            Activo = 1,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        return slug;
    }

    private async Task RenombrarEnBaseAsync(Guid negocioId, string nombre)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var negocio = db.Negocios.Single(n => n.Id == negocioId);
        negocio.Nombre = nombre;
        await db.SaveChangesAsync();
    }

    private static async Task<string?> NombreAsync(HttpClient client, string slug)
    {
        var response = await client.GetAsync($"/api/publico/negocios/{slug}");
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        return json.GetProperty("nombre").GetString();
    }

    [Fact]
    public async Task ObtenerNegocio_SegundaLectura_SeSirveDesdeCacheHastaQueElPropietarioEdita()
    {
        var negocioId = Guid.NewGuid();
        var slug = await SeedNegocioAsync(negocioId, "Nombre Original");
        var anonimo = _factory.CreateClient();

        Assert.Equal("Nombre Original", await NombreAsync(anonimo, slug));

        // Changed behind the API's back: a cached page keeps showing the old name.
        await RenombrarEnBaseAsync(negocioId, "Nombre Cambiado");
        Assert.Equal("Nombre Original", await NombreAsync(anonimo, slug));

        // An owner edit evicts the "negocio-{slug}" tag, so the next read is fresh.
        var propietario = _factory.CreateClient();
        propietario.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestTokenHelper.Propietario(negocioId));
        var patch = await propietario.PatchAsJsonAsync(
            "/api/negocios/perfil/colores", new { ColorPrimario = "#112233" });
        patch.EnsureSuccessStatusCode();

        Assert.Equal("Nombre Cambiado", await NombreAsync(anonimo, slug));
    }

    [Fact]
    public async Task ObtenerNegocio_ConAuthorization_NoUsaLaCache()
    {
        var negocioId = Guid.NewGuid();
        var slug = await SeedNegocioAsync(negocioId, "Antes");
        var anonimo = _factory.CreateClient();
        Assert.Equal("Antes", await NombreAsync(anonimo, slug));

        await RenombrarEnBaseAsync(negocioId, "Despues");

        var autenticado = _factory.CreateClient();
        autenticado.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestTokenHelper.Propietario(negocioId));
        Assert.Equal("Despues", await NombreAsync(autenticado, slug));
    }
}
