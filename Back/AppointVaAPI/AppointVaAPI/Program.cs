using AppointVaAPI.Data;
using AppointVaAPI.Jobs;
using AppointVaAPI.Models;
using AppointVaAPI.Repository;
using AppointVaAPI.Repository.IRepository;
using AppointVaAPI.Services;
using AppointVaAPI.Services.IServices;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.OpenApi;
using Scalar.AspNetCore;
using Serilog;
using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;
using AppointVaAPI.Filters;
using AppointVaAPI.Policies;
using System.IdentityModel.Tokens.Jwt;

// ── Serilog ────────────────────────────────────────────────────────────────────
Serilog.Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Warning()
    .MinimumLevel.Override("Microsoft.AspNetCore", Serilog.Events.LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .WriteTo.File("logs/appointva-.log",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 30,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} [{Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

// Evitar el límite de inotify en hosts Linux compartidos (Render free/starter tier).
// .NET usa FileSystemWatcher para vigilar cambios en appsettings.json —
// en producción no se necesita, y en hosts con muchos contenedores se agota el límite de 128.
Environment.SetEnvironmentVariable("DOTNET_hostBuilder__reloadConfigOnChange", "false");

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog();

// ── Sentry ─────────────────────────────────────────────────────────────────────
var sentryDsn = builder.Configuration["Sentry:Dsn"];
if (!string.IsNullOrEmpty(sentryDsn))
{
    builder.WebHost.UseSentry(o =>
    {
        o.Dsn = sentryDsn;
        o.Environment = builder.Environment.EnvironmentName;
        o.TracesSampleRate = 0.1;
        o.SendDefaultPii = false;
    });
}

// ── Base de datos ──────────────────────────────────────────────────────────────
// Compatibilidad de timestamps DateTime con PostgreSQL (comportamiento pre-6.0)
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var connectionString = builder.Configuration.GetConnectionString("ConexionSql");
builder.Services.AddDbContext<ApplicationDbContext>(opt =>
    opt.UseNpgsql(connectionString)
       .ConfigureWarnings(w => w.Log(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning)));

// ── Identity ───────────────────────────────────────────────────────────────────
builder.Services.AddIdentity<ApplicationUser, IdentityRole<Guid>>(opt =>
{
    opt.Password.RequiredLength = 6;
    opt.Password.RequireNonAlphanumeric = false;
    opt.Password.RequireUppercase = true;
    opt.Password.RequireDigit = true;
    opt.User.RequireUniqueEmail = true;
    opt.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    opt.Lockout.MaxFailedAccessAttempts = 5;
    opt.Lockout.AllowedForNewUsers = true;
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

// ── JWT ────────────────────────────────────────────────────────────────────────
var jwtClave = builder.Configuration["Jwt:Clave"]!;
builder.Services.AddAuthentication(opt =>
{
    opt.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    opt.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(opt =>
{
    opt.MapInboundClaims = false;
    opt.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Emisor"],
        ValidAudience = builder.Configuration["Jwt:Audiencia"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtClave)),
        RoleClaimType = "role",
        NameClaimType = "sub",
        ClockSkew = TimeSpan.Zero
    };
});

// ── CORS ───────────────────────────────────────────────────────────────────────
var origenesPermitidos = builder.Configuration["Cors:OrigenesPermitidos"]!.Split(',');
builder.Services.AddCors(opt =>
{
    opt.AddPolicy("FrontendPolicy", policy =>
        policy.WithOrigins(origenesPermitidos)
              .AllowAnyHeader()
              .AllowAnyMethod());
});

// ── Servicios propios ──────────────────────────────────────────────────────────
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IContextoNegocio, ContextoNegocio>();

// ── Repositorios ───────────────────────────────────────────────────────────────
builder.Services.AddScoped<ICategoriaRepository, CategoriaRepository>();
builder.Services.AddScoped<IServicioRepository, ServicioRepository>();
builder.Services.AddScoped<IEmpleadoRepository, EmpleadoRepository>();
builder.Services.AddScoped<INegocioRepository, NegocioRepository>();
builder.Services.AddScoped<IClienteRepository, ClienteRepository>();
builder.Services.AddScoped<ICitaRepository, CitaRepository>();
builder.Services.AddScoped<IDisponibilidadService, DisponibilidadService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<IWhatsAppService, WhatsAppService>();
builder.Services.AddScoped<INotificacionService, NotificacionService>();
builder.Services.AddScoped<IBlobStorageService, BlobStorageService>();
builder.Services.AddScoped<IPushService, PushService>();
builder.Services.AddScoped<IRecordatorioService, RecordatorioService>();
builder.Services.AddScoped<NotificacionJob>();
builder.Services.AddHttpClient("WhatsApp");
builder.Services.AddHttpClient("WebPush");
builder.Services.AddHttpClient("Brevo");

// ── Hangfire ───────────────────────────────────────────────────────────────────
builder.Services.AddHangfire(config => config
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UsePostgreSqlStorage(opt => opt.UseNpgsqlConnection(connectionString)));
builder.Services.AddHangfireServer();
GlobalJobFilters.Filters.Add(new AutomaticRetryAttribute { Attempts = 3, DelaysInSeconds = [60, 300, 600] });

// ── Límite de subida de archivos (5 MB) ───────────────────────────────────────
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(opt =>
{
    opt.MultipartBodyLengthLimit = 5 * 1024 * 1024;
});

// ── Rate Limiting (por IP, políticas por endpoint) ────────────────────────────
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync(
            "{\"mensaje\":\"Demasiadas solicitudes. Intenta de nuevo en un momento.\"}",
            cancellationToken);
    };

    // Autenticación: 20 intentos/min (login, refresh)
    options.AddPolicy("Auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));

    // Endpoints públicos generales: 60/min (consultar negocio, disponibilidad)
    options.AddPolicy("PublicoGeneral", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 60,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));

    // Endpoints estrictos: 5/min (crear cita, buscar mis-citas, ver/cancelar cita por código)
    options.AddPolicy("PublicoEstricto", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));

    // 2FA: 3 intentos por 5 minutos (limitar fuerza bruta sobre códigos TOTP)
    options.AddPolicy("TwoFA", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 3,
                Window = TimeSpan.FromMinutes(5),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));
});

// ── Health Checks ─────────────────────────────────────────────────────────────
builder.Services.AddHealthChecks()
    .AddDbContextCheck<ApplicationDbContext>("base-de-datos");

// ── Output Cache ───────────────────────────────────────────────────────────────
builder.Services.AddOutputCache(opt =>
{
    opt.AddBasePolicy(policy => policy.Expire(TimeSpan.FromMinutes(5)));
    opt.AddPolicy("NegocioPublico", NegocioPublicoPolicy.Instance);
});

// ── Compresión HTTP (Brotli + Gzip) ───────────────────────────────────────────
builder.Services.AddResponseCompression(opt =>
{
    opt.EnableForHttps = true;
    opt.Providers.Add<BrotliCompressionProvider>();
    opt.Providers.Add<GzipCompressionProvider>();
    opt.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(
        ["application/json", "application/problem+json"]);
});
builder.Services.Configure<BrotliCompressionProviderOptions>(opt =>
    opt.Level = System.IO.Compression.CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(opt =>
    opt.Level = System.IO.Compression.CompressionLevel.Fastest);

// ── Controllers + OpenAPI ─────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

// ── Migraciones y seed ────────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    if (app.Environment.IsEnvironment("Testing"))
    {
        // InMemory database: create schema and seed without relational migration.
        await db.Database.EnsureCreatedAsync();
        await DataSeeder.SeedAsync(scope.ServiceProvider);
    }
    else if (db.Database.IsRelational())
    {
        await db.Database.MigrateAsync();
        await db.Database.ExecuteSqlRawAsync(@"ALTER TABLE ""Negocios"" ADD COLUMN IF NOT EXISTS ""ListaEsperaActiva"" boolean NOT NULL DEFAULT false;");
        await db.Database.ExecuteSqlRawAsync("""
            ALTER TABLE "Citas" ADD COLUMN IF NOT EXISTS "MontoCobrado"   numeric(10,2) NULL;
            ALTER TABLE "Citas" ADD COLUMN IF NOT EXISTS "MontoRecibido"  numeric(10,2) NULL;
            ALTER TABLE "Citas" ADD COLUMN IF NOT EXISTS "Cambio"         numeric(10,2) NULL;
            ALTER TABLE "Citas" ADD COLUMN IF NOT EXISTS "FechaPago"      timestamptz   NULL;
            ALTER TABLE "Citas" ADD COLUMN IF NOT EXISTS "RegistradoPorId" uuid         NULL;
            ALTER TABLE "Citas" ADD COLUMN IF NOT EXISTS "Propina"        numeric(10,2) NULL;
        """);
        await db.Database.ExecuteSqlRawAsync("""
            ALTER TABLE "Negocios" ADD COLUMN IF NOT EXISTS "ModuloPagosHabilitado" boolean NOT NULL DEFAULT false;
        """);
        await DataSeeder.SeedAsync(scope.ServiceProvider);
    }
    else
    {
        await db.Database.EnsureCreatedAsync();
        await DataSeeder.SeedAsync(scope.ServiceProvider);
    }
}

// ── Pipeline HTTP ─────────────────────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(opt => opt.Title = "AppointVa API");
}

// Hangfire dashboard — protegido con cookie validada por HangfireAuthorizationFilter
app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    Authorization = [new HangfireAuthorizationFilter(app.Configuration)],
    DashboardTitle = "AppointVa — Jobs",
    IsReadOnlyFunc = _ => false,
});

// Endpoint que valida el JWT, pone la cookie y redirige al dashboard
app.MapGet("/hangfire-session", (HttpContext ctx, IConfiguration config) =>
{
    var token = ctx.Request.Query["token"].FirstOrDefault();
    if (string.IsNullOrEmpty(token)) return Results.Redirect("/hangfire");

    try
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Clave"]!));
        var principal = new JwtSecurityTokenHandler().ValidateToken(token,
            new TokenValidationParameters
            {
                ValidateIssuer           = true,
                ValidateAudience         = true,
                ValidateLifetime         = true,
                ValidateIssuerSigningKey  = true,
                ValidIssuer              = config["Jwt:Emisor"],
                ValidAudience            = config["Jwt:Audiencia"],
                IssuerSigningKey         = key,
                RoleClaimType            = "role",
                NameClaimType            = "sub",
                ClockSkew                = TimeSpan.Zero,
            }, out _);

        if (!principal.IsInRole("SuperAdmin")) return Results.Redirect("/hangfire");

        ctx.Response.Cookies.Append("hangfire_auth", token, new CookieOptions
        {
            HttpOnly  = true,
            Secure    = true,
            SameSite  = SameSiteMode.Strict,
            MaxAge    = TimeSpan.FromMinutes(60),
        });

        return Results.Redirect("/hangfire");
    }
    catch
    {
        return Results.Redirect("/hangfire");
    }
});

// ── Security headers ──────────────────────────────────────────────────────────
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    ctx.Response.Headers.Append("X-Frame-Options", "DENY");
    ctx.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    ctx.Response.Headers.Append("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    ctx.Response.Headers.Append("X-XSS-Protection", "0"); // CSP is the modern replacement
    await next();
});
app.UseMiddleware<AppointVaAPI.Middleware.ExceptionHandlingMiddleware>();
app.UseResponseCompression();
app.UseHttpsRedirection();
app.UseCors("FrontendPolicy");
if (!string.IsNullOrEmpty(sentryDsn)) app.UseSentryTracing();
app.UseStaticFiles(); // sirve wwwroot/uploads/ cuando Cloudinary no está configurado
if (!app.Environment.IsEnvironment("Testing"))
    app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.UseOutputCache();
app.MapControllers();
// Ping sin DB — usar este para keep-alive (no consume compute de Neon)
app.MapGet("/ping", () => Results.Ok(new { status = "ok" }));

app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = async (ctx, report) =>
    {
        ctx.Response.ContentType = "application/json";
        var result = JsonSerializer.Serialize(new
        {
            estado = report.Status.ToString(),
            checks = report.Entries.Select(e => new { nombre = e.Key, estado = e.Value.Status.ToString() })
        });
        await ctx.Response.WriteAsync(result);
    }
});
// ── Sitemap dinámico ──────────────────────────────────────────────────────────
app.MapGet("/sitemap.xml", async (ApplicationDbContext db) =>
{
    var slugs = await db.Negocios
        .Where(n => n.FechaEliminacion == null && n.Activo == 1)
        .Select(n => n.Slug)
        .ToListAsync();

    var sb = new System.Text.StringBuilder();
    sb.AppendLine("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    sb.AppendLine("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">");
    foreach (var path in new[] { "/", "/privacidad", "/terminos" })
        sb.AppendLine($"  <url><loc>https://appointva.com{path}</loc><changefreq>monthly</changefreq></url>");
    foreach (var slug in slugs)
        sb.AppendLine($"  <url><loc>https://appointva.com/b/{slug}</loc><changefreq>weekly</changefreq></url>");
    sb.AppendLine("</urlset>");

    return Results.Content(sb.ToString(), "application/xml; charset=utf-8");
});

app.Run();

public partial class Program { }
