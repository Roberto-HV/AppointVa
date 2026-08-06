using System.Net.Http.Headers;
using System.Text;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;
using Hangfire;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.InMemory.Infrastructure.Internal;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;
using NSubstitute;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    // The exact same constants as TestTokenHelper so the validation key always
    // matches what the tokens are signed with.
    internal const string TestJwtKey      = "test-secret-key-32-chars-minimum-x";
    internal const string TestJwtIssuer   = "test-issuer";
    internal const string TestJwtAudience = "test-audience";

    // A dedicated EF Core internal service provider that only knows about the
    // InMemory provider.  Shared across all factory instances (static) so the
    // underlying InMemory store is reused; databases are isolated by name.
    private static readonly ServiceProvider _efInMemoryProvider =
        new ServiceCollection()
            .AddEntityFrameworkInMemoryDatabase()
            .BuildServiceProvider();

    // Stable database name for this factory instance.  Computing it here
    // (not inside the AddDbContext lambda) ensures every DI scope — both
    // test-code scopes and HTTP-request scopes — resolve the same
    // InMemory database, so data seeded in tests is visible to the server.
    private readonly string _dbName = "IntegrationTestDb_" + Guid.NewGuid();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        // ConfigureAppConfiguration in the minimal hosting model runs BEFORE
        // WebApplication.CreateBuilder loads appsettings.json, so those values
        // would overwrite our overrides.  We keep this block for non-JWT config
        // (DB connection string, etc.) but override JWT through PostConfigure
        // below, which always wins.
        builder.ConfigureAppConfiguration((_, cfg) =>
        {
            cfg.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:ConexionSql"] = "Host=test;Database=test;Username=test;Password=test",
                ["Jwt:Clave"]                     = TestJwtKey,
                ["Jwt:Emisor"]                    = TestJwtIssuer,
                ["Jwt:Audiencia"]                 = TestJwtAudience,
                ["Jwt:ExpiracionMinutos"]          = "60",
                ["Jwt:RefreshExpiracionDias"]      = "7",
                ["Cors:OrigenesPermitidos"]        = "http://localhost",
                ["Email:ApiKey"]                  = "fake",
                ["Sentry:Dsn"]                    = "",
            });
        });

        builder.ConfigureServices(services =>
        {
            // ── JWT ──────────────────────────────────────────────────────────
            // PostConfigure runs after ALL Configure callbacks (including the
            // one in Program.cs) so it always has the final say on which key,
            // issuer, and audience the bearer middleware validates against.
            services.PostConfigure<JwtBearerOptions>(
                JwtBearerDefaults.AuthenticationScheme,
                opt =>
                {
                    opt.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer           = true,
                        ValidateAudience         = true,
                        ValidateLifetime         = true,
                        ValidateIssuerSigningKey  = true,
                        ValidIssuer              = TestJwtIssuer,
                        ValidAudience            = TestJwtAudience,
                        IssuerSigningKey         = new SymmetricSecurityKey(
                                                       Encoding.UTF8.GetBytes(TestJwtKey)),
                        RoleClaimType            = "role",
                        NameClaimType            = "sub",
                        ClockSkew                = TimeSpan.Zero,
                    };
                });

            // ── EF Core ──────────────────────────────────────────────────────
            // Remove every EF/Npgsql descriptor Program.cs registered so we
            // can install a clean InMemory-only context.  This includes:
            //  - DbContextOptions<ApplicationDbContext>  (Npgsql options)
            //  - DbContextOptions (non-generic forwarding descriptor)
            //  - ApplicationDbContext itself (registered via TryAdd – must be
            //    removed so AddDbContext below can re-register it fresh)
            //  - Any service whose type or implementation references Npgsql
            var toRemove = services
                .Where(d =>
                    d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>) ||
                    d.ServiceType == typeof(DbContextOptions) ||
                    d.ServiceType == typeof(ApplicationDbContext) ||
                    ContainsNpgsql(d.ServiceType) ||
                    ContainsNpgsql(d.ImplementationType))
                .ToList();
            foreach (var d in toRemove) services.Remove(d);

            // UseInternalServiceProvider pins EF Core to our isolated InMemory
            // provider so it never queries the app DI for IDatabaseProvider.
            services.AddDbContext<ApplicationDbContext>(opt =>
                opt.UseInMemoryDatabase(_dbName)
                   .UseInternalServiceProvider(_efInMemoryProvider)
                   .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));

            // ── Hangfire ─────────────────────────────────────────────────────
            // Remove ALL Hangfire services including hosted services registered
            // via factory lambdas (ImplementationType is null for those; check
            // the factory delegate's declaring type instead).
            var hangfireToRemove = services
                .Where(d =>
                    d.ImplementationType?.FullName?.Contains("Hangfire") == true ||
                    d.ServiceType.FullName?.Contains("Hangfire") == true ||
                    d.ImplementationFactory?.Method.DeclaringType?.FullName?.Contains("Hangfire") == true)
                .ToList();
            foreach (var d in hangfireToRemove) services.Remove(d);

            // Replace IBackgroundJobClient with a no-op mock.
            services.AddSingleton<IBackgroundJobClient>(
                Substitute.For<IBackgroundJobClient>());

            // ── External notification/storage services ────────────────────────
            // Prevent real HTTP calls to Brevo, WhatsApp, Cloudinary, etc.
            services.RemoveAll<IEmailService>();
            services.RemoveAll<IWhatsAppService>();
            services.RemoveAll<INotificacionService>();
            services.RemoveAll<IPushService>();
            services.RemoveAll<IBlobStorageService>();

            services.AddScoped(_ => Substitute.For<IEmailService>());
            services.AddScoped(_ => Substitute.For<IWhatsAppService>());
            services.AddScoped(_ => Substitute.For<INotificacionService>());
            services.AddScoped(_ => Substitute.For<IPushService>());
            services.AddScoped(_ => Substitute.For<IBlobStorageService>());
        });
    }

    public async Task SeedNegocioAsync(Guid negocioId)
    {
        await using var scope = Services.CreateAsyncScope();
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

    public HttpClient CreateAuthenticatedClient(string token)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    // Returns true if a type (or any of its generic arguments, recursively)
    // lives in a Npgsql assembly.
    private static bool ContainsNpgsql(Type? type)
    {
        if (type is null) return false;
        if (type.Assembly.GetName().Name?.Contains("Npgsql") == true) return true;
        if (type.IsGenericType)
        {
            foreach (var arg in type.GetGenericArguments())
                if (ContainsNpgsql(arg)) return true;
        }
        return false;
    }
}
