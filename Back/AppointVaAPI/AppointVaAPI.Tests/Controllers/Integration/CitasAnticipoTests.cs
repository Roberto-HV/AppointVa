using System.Net;
using System.Net.Http.Json;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Citas;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class CitasAnticipoTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public CitasAnticipoTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<(Guid negocioId, Guid citaId)> SeedCitaConAnticipoAsync()
    {
        var negocioId = Guid.NewGuid();
        var citaId = Guid.NewGuid();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppointVaAPI.Data.ApplicationDbContext>();

        await _factory.SeedNegocioAsync(negocioId);

        var empleadoId = Guid.NewGuid();
        var clienteId = Guid.NewGuid();
        var servicioId = Guid.NewGuid();

        db.Empleados.Add(new AppointVaAPI.Models.Empleado
        {
            Id = empleadoId, NegocioId = negocioId, Nombre = "Test Empleado",
            Email = "emp@test.com", FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        });
        db.Clientes.Add(new AppointVaAPI.Models.Cliente
        {
            Id = clienteId, NegocioId = negocioId, NombreCompleto = "Cliente Test",
            Telefono = "5551234567", FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        });
        db.Servicios.Add(new AppointVaAPI.Models.Servicio
        {
            Id = servicioId, NegocioId = negocioId, Nombre = "Corte", Precio = 200m,
            DuracionMinutos = 30, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        });
        db.Citas.Add(new Cita
        {
            Id = citaId, NegocioId = negocioId, CodigoConfirmacion = "TST001",
            ClienteId = clienteId, EmpleadoId = empleadoId, ServicioId = servicioId,
            InicioEn = DateTime.UtcNow.AddDays(1), FinEn = DateTime.UtcNow.AddDays(1).AddMinutes(30),
            Estado = 2, Precio = 200m,
            AnticipoRequerido = true, MontoAnticipo = 50m,
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        return (negocioId, citaId);
    }

    [Fact]
    public async Task MarcarAnticipo_Recibido_True_SetsCamposCorrectamente()
    {
        // Arrange
        var (negocioId, citaId) = await SeedCitaConAnticipoAsync();
        var client = _factory.CreateAuthenticatedClient(TestTokenHelper.Propietario(negocioId));

        // Act
        var response = await client.PatchAsJsonAsync(
            $"/api/citas/{citaId}/anticipo",
            new { Recibido = true });

        // Assert
        response.EnsureSuccessStatusCode();
        var dto = await response.Content.ReadFromJsonAsync<CitaDto>();
        Assert.NotNull(dto);
        Assert.True(dto!.AnticipoRecibido);
        Assert.NotNull(dto.AnticipoRecibidoEn);
    }

    [Fact]
    public async Task MarcarAnticipo_Recibido_False_LimpiaLasCampos()
    {
        // Arrange
        var (negocioId, citaId) = await SeedCitaConAnticipoAsync();
        var client = _factory.CreateAuthenticatedClient(TestTokenHelper.Propietario(negocioId));
        await client.PatchAsJsonAsync($"/api/citas/{citaId}/anticipo", new { Recibido = true });

        // Act
        var response = await client.PatchAsJsonAsync(
            $"/api/citas/{citaId}/anticipo",
            new { Recibido = false });

        // Assert
        response.EnsureSuccessStatusCode();
        var dto = await response.Content.ReadFromJsonAsync<CitaDto>();
        Assert.NotNull(dto);
        Assert.False(dto!.AnticipoRecibido);
        Assert.Null(dto.AnticipoRecibidoEn);
    }

    [Fact]
    public async Task MarcarAnticipo_ComoEmpleado_Devuelve200()
    {
        // Arrange
        var (negocioId, citaId) = await SeedCitaConAnticipoAsync();
        var client = _factory.CreateAuthenticatedClient(TestTokenHelper.Empleado(negocioId));

        // Act
        var response = await client.PatchAsJsonAsync(
            $"/api/citas/{citaId}/anticipo",
            new { Recibido = true });

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
