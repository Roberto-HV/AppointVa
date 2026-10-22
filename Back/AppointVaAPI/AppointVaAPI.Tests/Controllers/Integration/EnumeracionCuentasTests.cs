using System.Net;
using System.Net.Http.Json;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>
/// S5: registration and login must not reveal whether an email has an account.
/// </summary>
public class EnumeracionCuentasTests : IClassFixture<CustomWebApplicationFactory>
{
    private const string Contrasena = "Contrasena123!";
    private readonly CustomWebApplicationFactory _factory;

    public EnumeracionCuentasTests(CustomWebApplicationFactory factory) => _factory = factory;

    private async Task<ApplicationUser> CrearUsuarioAsync(bool bloqueado)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var email = $"existente-{Guid.NewGuid():N}@ejemplo.com";
        var usuario = new ApplicationUser
        {
            Id = Guid.NewGuid(), UserName = email, Email = email, EmailConfirmed = true,
            Nombre = "Existente", Activo = true, FechaCreacion = DateTime.UtcNow
        };
        (await um.CreateAsync(usuario, Contrasena)).Succeeded.Should().BeTrue();
        if (bloqueado)
        {
            await um.SetLockoutEnabledAsync(usuario, true);
            await um.SetLockoutEndDateAsync(usuario, DateTimeOffset.UtcNow.AddMinutes(15));
        }
        return usuario;
    }

    private static object Registro(string email, string contrasena = Contrasena)
    {
        var sufijo = Guid.NewGuid().ToString("N")[..8];
        return new
        {
            NombreNegocio = "Negocio Enum",
            Slug = $"negocio-enum-{sufijo}",
            NombrePropietario = "Propietaria",
            Email = email,
            Contrasena = contrasena,
            Sector = "belleza"
        };
    }

    [Fact]
    public async Task Registro_ConCorreoExistente_RespondeIgualQueUnoNuevoYNoCreaNada()
    {
        var existente = await CrearUsuarioAsync(bloqueado: false);
        var client = _factory.CreateClient();

        var nuevo = await client.PostAsJsonAsync("/api/publico/registro",
            Registro($"nuevo-{Guid.NewGuid():N}@ejemplo.com"));
        var dtoDuplicado = Registro(existente.Email!);
        var duplicado = await client.PostAsJsonAsync("/api/publico/registro", dtoDuplicado);

        nuevo.StatusCode.Should().Be(HttpStatusCode.Created);
        duplicado.StatusCode.Should().Be(nuevo.StatusCode);
        (await duplicado.Content.ReadAsStringAsync()).Should().Be(await nuevo.Content.ReadAsStringAsync());

        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var slug = (string)dtoDuplicado.GetType().GetProperty("Slug")!.GetValue(dtoDuplicado)!;
        db.Negocios.Any(n => n.Slug == slug).Should().BeFalse();
    }

    [Fact]
    public async Task Registro_ContrasenaDebilConCorreoExistente_Retorna400ComoUnoNuevo()
    {
        var existente = await CrearUsuarioAsync(bloqueado: false);
        var client = _factory.CreateClient();

        var r = await client.PostAsJsonAsync("/api/publico/registro", Registro(existente.Email!, "debil123"));

        r.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Login_CuentaBloqueada_RespondeIgualQueCredencialesInvalidas()
    {
        var bloqueado = await CrearUsuarioAsync(bloqueado: true);
        var client = _factory.CreateClient();

        var inexistente = await client.PostAsJsonAsync("/api/auth/login",
            new { Email = $"nadie-{Guid.NewGuid():N}@ejemplo.com", Contrasena });
        // Correct password on purpose: even then a locked account must not stand out.
        var cuentaBloqueada = await client.PostAsJsonAsync("/api/auth/login",
            new { Email = bloqueado.Email, Contrasena });

        inexistente.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        cuentaBloqueada.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await cuentaBloqueada.Content.ReadAsStringAsync())
            .Should().Be(await inexistente.Content.ReadAsStringAsync());
    }
}
