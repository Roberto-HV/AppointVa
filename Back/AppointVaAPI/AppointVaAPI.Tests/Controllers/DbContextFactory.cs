using AppointVaAPI.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace AppointVaAPI.Tests.Controllers;

/// <summary>
/// Crea instancias de ApplicationDbContext con base de datos en memoria
/// para tests de controllers. Cada llamada genera una DB aislada.
/// </summary>
internal static class DbContextFactory
{
    public static ApplicationDbContext Create(string? nombre = null)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(nombre ?? $"TestDb_{Guid.NewGuid()}")
            // InMemory no soporta transacciones reales; ignorar la advertencia
            // para que BeginTransactionAsync funcione como no-op en tests.
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        var db = new ApplicationDbContext(options);
        db.Database.EnsureCreated();
        return db;
    }
}
