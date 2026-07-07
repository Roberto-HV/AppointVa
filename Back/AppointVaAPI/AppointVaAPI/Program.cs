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
});

// ── Controllers + OpenAPI ─────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

// ── Migraciones y seed ────────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await db.Database.MigrateAsync();
    await DataSeeder.SeedAsync(scope.ServiceProvider);
}

// ── Pipeline HTTP ─────────────────────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(opt => opt.Title = "AppointVa API");
    app.UseHangfireDashboard("/hangfire");
}

app.UseMiddleware<AppointVaAPI.Middleware.ExceptionHandlingMiddleware>();
app.UseHttpsRedirection();
app.UseCors("FrontendPolicy");
if (!string.IsNullOrEmpty(sentryDsn)) app.UseSentryTracing();
app.UseStaticFiles(); // sirve wwwroot/uploads/ cuando Cloudinary no está configurado
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.UseOutputCache();
app.MapControllers();
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
app.Run();
