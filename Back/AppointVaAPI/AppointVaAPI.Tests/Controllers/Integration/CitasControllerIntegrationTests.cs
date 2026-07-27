using System.Net;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class CitasControllerIntegrationTests : IntegrationTestBase
{
    private readonly CustomWebApplicationFactory _factory;

    public CitasControllerIntegrationTests(CustomWebApplicationFactory factory)
        : base(factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Listar_SinToken_Retorna401()
    {
        ClearToken();

        var response = await Client.GetAsync("/api/citas");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Listar_ConSuperAdmin_Retorna403()
    {
        SetToken(TestTokenHelper.SuperAdmin());

        var response = await Client.GetAsync("/api/citas");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Listar_ConPropietario_Retorna200()
    {
        SetToken(TestTokenHelper.Propietario());

        var response = await Client.GetAsync("/api/citas");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Listar_ConEmpleado_Retorna200()
    {
        // The CitasController requires the token's UsuarioId to match an
        // existing Empleado record (employee can only see their own appointments).
        // We seed a matching record so the guard passes and the response is 200.
        var userId    = Guid.NewGuid();
        var negocioId = Guid.NewGuid();

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Empleados.Add(new Empleado
            {
                Id                  = Guid.NewGuid(),
                NegocioId           = negocioId,
                UsuarioId           = userId,
                Nombre              = "Test Empleado",
                Activo              = 1,
                FechaCreacion       = DateTime.UtcNow,
                FechaActualizacion  = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        SetToken(TestTokenHelper.GenerarToken("Empleado", negocioId, userId));

        var response = await Client.GetAsync("/api/citas");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
