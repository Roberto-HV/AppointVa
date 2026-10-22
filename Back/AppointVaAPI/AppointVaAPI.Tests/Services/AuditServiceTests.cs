using AppointVaAPI.Data;
using AppointVaAPI.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;

namespace AppointVaAPI.Tests.Services;

/// <summary>Fail-open vs fail-closed audit writes.</summary>
public class AuditServiceTests
{
    private sealed class GuardadoFallido : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("base de datos caída");
    }

    private static (AuditService servicio, ApplicationDbContext db) Crear(bool falla)
    {
        var builder = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"Audit_{Guid.NewGuid()}");
        if (falla) builder.AddInterceptors(new GuardadoFallido());
        var db = new ApplicationDbContext(builder.Options);
        return (new AuditService(db, new HttpContextAccessor(), NullLogger<AuditService>.Instance), db);
    }

    [Fact]
    public async Task RegistrarObligatorio_SiElGuardadoFalla_DevuelveFalse_YNoDejaLaFilaPendiente()
    {
        var (servicio, db) = Crear(falla: true);

        (await servicio.RegistrarObligatorioAsync("Prueba")).Should().BeFalse();
        db.ChangeTracker.Entries().Should().BeEmpty();
    }

    [Fact]
    public async Task RegistrarObligatorio_SiGuarda_DevuelveTrue()
    {
        var (servicio, db) = Crear(falla: false);

        (await servicio.RegistrarObligatorioAsync("Prueba")).Should().BeTrue();
        (await db.AuditLogs.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task Registrar_SiElGuardadoFalla_NoLanza()
    {
        var (servicio, _) = Crear(falla: true);

        var accion = () => servicio.RegistrarAsync("Prueba");

        await accion.Should().NotThrowAsync();
    }
}
