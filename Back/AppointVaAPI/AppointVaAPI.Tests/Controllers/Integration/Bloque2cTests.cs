using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>
/// Backend batch 2c: B2, B4 (public appointment payload), B11 (cover position),
/// B12 (gallery order), B15 (review stats), B20 (plan at sign-up),
/// B23 (activation queue fields) and B24 (audit filters).
/// </summary>
public class Bloque2cTests : IntegrationTestBase
{
    public Bloque2cTests(CustomWebApplicationFactory factory) : base(factory) { }

    private static string Sufijo() => Guid.NewGuid().ToString("N")[..8];

    private async Task<T> ConDbAsync<T>(Func<ApplicationDbContext, Task<T>> accion)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        return await accion(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>());
    }

    private async Task<Negocio> CrearNegocioAsync(Action<Negocio>? configurar = null)
    {
        var ahora = DateTime.UtcNow;
        var negocio = new Negocio
        {
            Id = Guid.NewGuid(), Nombre = "Negocio 2c", Slug = $"b2c-{Sufijo()}", ZonaHoraria = "UTC",
            Activo = 1, FechaCreacion = ahora, FechaActualizacion = ahora,
        };
        configurar?.Invoke(negocio);
        await ConDbAsync(async db => { db.Negocios.Add(negocio); return await db.SaveChangesAsync(); });
        return negocio;
    }

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage r) =>
        await r.Content.ReadFromJsonAsync<JsonElement>();

    // ── B2 + B4: public appointment payload and Mis citas ──────────────────────

    private async Task<(Negocio Negocio, string Codigo, string Email)> CrearCitaAsync()
    {
        var negocio = await CrearNegocioAsync(n => { n.Sector = "salud"; n.DiasAnticipacionMinima = 3; });
        var ahora = DateTime.UtcNow;
        var email = $"cliente-{Sufijo()}@test.com";
        var codigo = Sufijo().ToUpper();
        await ConDbAsync(async db =>
        {
            var servicio = new Servicio
            {
                Id = Guid.NewGuid(), NegocioId = negocio.Id, Nombre = "Consulta", DuracionMinutos = 30,
                Precio = 300m, Orden = 1, Activo = 1, FechaCreacion = ahora, FechaActualizacion = ahora,
            };
            var empleado = new Empleado
            {
                Id = Guid.NewGuid(), NegocioId = negocio.Id, Nombre = "Dra. Ana", Activo = 1,
                FechaCreacion = ahora, FechaActualizacion = ahora,
            };
            var cliente = new Cliente
            {
                Id = Guid.NewGuid(), NegocioId = negocio.Id, NombreCompleto = "Paciente", Email = email,
                Telefono = "5551112222", FechaCreacion = ahora, FechaActualizacion = ahora,
            };
            db.AddRange(servicio, empleado, cliente);
            db.Citas.Add(new Cita
            {
                Id = Guid.NewGuid(), NegocioId = negocio.Id, ServicioId = servicio.Id, EmpleadoId = empleado.Id,
                ClienteId = cliente.Id, InicioEn = ahora.AddDays(7), FinEn = ahora.AddDays(7).AddMinutes(30),
                Estado = EstadosCitas.Confirmada, Precio = 300m, CodigoConfirmacion = codigo,
                FechaCreacion = ahora, FechaActualizacion = ahora,
            });
            return await db.SaveChangesAsync();
        });
        return (negocio, codigo, email);
    }

    [Fact]
    public async Task CitaPublica_IncluyeDiasAnticipacionMinimaYSector()
    {
        var (_, codigo, _) = await CrearCitaAsync();

        var r = await NewClient().GetAsync($"/api/publico/citas/{codigo}");

        r.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await JsonAsync(r);
        json.GetProperty("diasAnticipacionMinima").GetInt32().Should().Be(3);
        json.GetProperty("sector").GetString().Should().Be("salud");
    }

    [Fact]
    public async Task MisCitas_IncluyeDiasAnticipacionMinima()
    {
        var (negocio, _, email) = await CrearCitaAsync();

        var r = await NewClient().GetAsync($"/api/publico/mis-citas?slug={negocio.Slug}&email={email}");

        r.StatusCode.Should().Be(HttpStatusCode.OK);
        var items = await JsonAsync(r);
        items.GetArrayLength().Should().Be(1);
        items[0].GetProperty("diasAnticipacionMinima").GetInt32().Should().Be(3);
        items[0].GetProperty("servicioId").GetGuid().Should().NotBeEmpty();
        items[0].GetProperty("empleadoId").GetGuid().Should().NotBeEmpty();
        items[0].GetProperty("horasCancelacion").GetInt32().Should().Be(negocio.HorasCancelacion);
    }

    // ── B11: cover position on its own ─────────────────────────────────────────

    private async Task<string?> PosicionEnDbAsync(Guid negocioId) =>
        await ConDbAsync(async db => (await db.Negocios.AsNoTracking().FirstAsync(n => n.Id == negocioId)).PortadaObjectPosition);

    [Fact]
    public async Task PosicionPortada_Propietario_GuardaSoloLaPosicion()
    {
        var negocio = await CrearNegocioAsync(n => { n.PortadaUrl = "https://cdn.test/p.jpg"; n.Telefono = "5550001111"; });

        var r = await NewClient(TestTokenHelper.Propietario(negocio.Id))
            .PatchAsJsonAsync("/api/negocios/perfil/portada/posicion", new { portadaObjectPosition = "30.5% 72%" });

        r.StatusCode.Should().Be(HttpStatusCode.OK);
        (await JsonAsync(r)).GetProperty("portadaObjectPosition").GetString().Should().Be("30.5% 72%");
        var guardado = await ConDbAsync(async db => await db.Negocios.AsNoTracking().FirstAsync(n => n.Id == negocio.Id));
        guardado.PortadaObjectPosition.Should().Be("30.5% 72%");
        guardado.Telefono.Should().Be("5550001111", "the PATCH must not touch other profile fields");
    }

    [Theory]
    [InlineData("center")]
    [InlineData("50%")]
    [InlineData("120% 50%")]
    [InlineData("50% 50%; color:red")]
    public async Task PosicionPortada_ValorInvalido_Retorna400(string posicion)
    {
        var negocio = await CrearNegocioAsync(n => n.PortadaUrl = "https://cdn.test/p.jpg");

        var r = await NewClient(TestTokenHelper.Propietario(negocio.Id))
            .PatchAsJsonAsync("/api/negocios/perfil/portada/posicion", new { portadaObjectPosition = posicion });

        r.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await PosicionEnDbAsync(negocio.Id)).Should().BeNull();
    }

    [Fact]
    public async Task PosicionPortada_SinFotoDePortada_Retorna400()
    {
        var negocio = await CrearNegocioAsync();

        var r = await NewClient(TestTokenHelper.Propietario(negocio.Id))
            .PatchAsJsonAsync("/api/negocios/perfil/portada/posicion", new { portadaObjectPosition = "50% 50%" });

        r.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PosicionPortada_Empleado_Retorna403()
    {
        var negocio = await CrearNegocioAsync(n => n.PortadaUrl = "https://cdn.test/p.jpg");

        var r = await NewClient(TestTokenHelper.Empleado(negocio.Id))
            .PatchAsJsonAsync("/api/negocios/perfil/portada/posicion", new { portadaObjectPosition = "50% 50%" });

        r.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── B12: gallery order ─────────────────────────────────────────────────────

    private async Task<List<Guid>> CrearGaleriaAsync(Guid negocioId, int cantidad)
    {
        var ids = Enumerable.Range(0, cantidad).Select(_ => Guid.NewGuid()).ToList();
        await ConDbAsync(async db =>
        {
            for (var i = 0; i < cantidad; i++)
                db.ImagenesNegocios.Add(new ImagenNegocio
                {
                    Id = ids[i], NegocioId = negocioId, Url = $"https://cdn.test/{i}.jpg", Orden = i + 1,
                    FechaCreacion = DateTime.UtcNow,
                });
            return await db.SaveChangesAsync();
        });
        return ids;
    }

    [Fact]
    public async Task ReordenarGaleria_GuardaElNuevoOrdenYLoUsaLaPaginaPublica()
    {
        var negocio = await CrearNegocioAsync();
        var ids = await CrearGaleriaAsync(negocio.Id, 3);
        var nuevo = new List<Guid> { ids[2], ids[0], ids[1] };

        var r = await NewClient(TestTokenHelper.Propietario(negocio.Id))
            .PatchAsJsonAsync("/api/negocios/galeria/reordenar", new { ids = nuevo });

        r.StatusCode.Should().Be(HttpStatusCode.OK);
        var cuerpo = await JsonAsync(r);
        cuerpo.EnumerateArray().Select(e => e.GetProperty("id").GetGuid()).Should().Equal(nuevo);

        var listado = await JsonAsync(await NewClient(TestTokenHelper.Propietario(negocio.Id)).GetAsync("/api/negocios/galeria"));
        listado.EnumerateArray().Select(e => e.GetProperty("id").GetGuid()).Should().Equal(nuevo);
        listado.EnumerateArray().Select(e => e.GetProperty("orden").GetInt32()).Should().Equal(1, 2, 3);
    }

    [Fact]
    public async Task ReordenarGaleria_ConFotoDeOtroNegocio_Retorna400YNoCambiaNada()
    {
        var negocio = await CrearNegocioAsync();
        var otro = await CrearNegocioAsync();
        var ids = await CrearGaleriaAsync(negocio.Id, 2);
        var ajenas = await CrearGaleriaAsync(otro.Id, 1);

        var r = await NewClient(TestTokenHelper.Propietario(negocio.Id))
            .PatchAsJsonAsync("/api/negocios/galeria/reordenar", new { ids = new[] { ids[1], ajenas[0] } });

        r.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var ordenAjena = await ConDbAsync(async db => (await db.ImagenesNegocios.AsNoTracking().FirstAsync(i => i.Id == ajenas[0])).Orden);
        ordenAjena.Should().Be(1);
        var ordenPropia = await ConDbAsync(async db => (await db.ImagenesNegocios.AsNoTracking().FirstAsync(i => i.Id == ids[1])).Orden);
        ordenPropia.Should().Be(2);
    }

    [Fact]
    public async Task ReordenarGaleria_ListaIncompletaODuplicada_Retorna400()
    {
        var negocio = await CrearNegocioAsync();
        var ids = await CrearGaleriaAsync(negocio.Id, 3);
        var client = NewClient(TestTokenHelper.Propietario(negocio.Id));

        var incompleta = await client.PatchAsJsonAsync("/api/negocios/galeria/reordenar", new { ids = new[] { ids[0], ids[1] } });
        var duplicada = await client.PatchAsJsonAsync("/api/negocios/galeria/reordenar", new { ids = new[] { ids[0], ids[0], ids[1] } });

        incompleta.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        duplicada.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ReordenarGaleria_Empleado_Retorna403()
    {
        var negocio = await CrearNegocioAsync();
        var ids = await CrearGaleriaAsync(negocio.Id, 2);

        var r = await NewClient(TestTokenHelper.Empleado(negocio.Id))
            .PatchAsJsonAsync("/api/negocios/galeria/reordenar", new { ids = new[] { ids[1], ids[0] } });

        r.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── B15: approved reviews with server-side stats ───────────────────────────

    [Fact]
    public async Task Resenas_SoloAprobadasConPromedioYDistribucionDeTodas()
    {
        var negocio = await CrearNegocioAsync();
        var otro = await CrearNegocioAsync();
        await ConDbAsync(async db =>
        {
            void Agregar(Guid negocioId, int rating, bool aprobada, bool respondida) => db.Resenas.Add(new Resena
            {
                Id = Guid.NewGuid(), NegocioId = negocioId, Rating = rating, NombreCliente = "C", Token = Guid.NewGuid().ToString("N"),
                Aprobada = aprobada, Respondida = respondida, FechaCreacion = DateTime.UtcNow,
            });
            Agregar(negocio.Id, 5, true, true);
            Agregar(negocio.Id, 5, true, true);
            Agregar(negocio.Id, 4, true, true);
            Agregar(negocio.Id, 1, false, true);  // not approved
            Agregar(negocio.Id, 2, true, false);  // invitation not answered yet
            Agregar(otro.Id, 1, true, true);      // other business
            return await db.SaveChangesAsync();
        });

        // Page size 1: stats must still cover all three approved reviews.
        var r = await NewClient(TestTokenHelper.Propietario(negocio.Id)).GetAsync("/api/me/resenas?page=1&pageSize=1");

        r.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await JsonAsync(r);
        json.GetProperty("total").GetInt32().Should().Be(3);
        json.GetProperty("items").GetArrayLength().Should().Be(1);
        json.GetProperty("promedio").GetDecimal().Should().Be(4.7m);
        var dist = json.GetProperty("distribucion");
        dist.GetProperty("5").GetInt32().Should().Be(2);
        dist.GetProperty("4").GetInt32().Should().Be(1);
        dist.GetProperty("1").GetInt32().Should().Be(0);
        dist.GetProperty("2").GetInt32().Should().Be(0);
    }

    [Fact]
    public async Task Resenas_SinResenas_PromedioNulo()
    {
        var negocio = await CrearNegocioAsync();

        var json = await JsonAsync(await NewClient(TestTokenHelper.Propietario(negocio.Id)).GetAsync("/api/me/resenas"));

        json.GetProperty("total").GetInt32().Should().Be(0);
        json.GetProperty("promedio").ValueKind.Should().Be(JsonValueKind.Null);
        json.GetProperty("distribucion").GetProperty("3").GetInt32().Should().Be(0);
    }

    // ── B20: plan chosen at sign-up ────────────────────────────────────────────

    private static object Registro(string slug, string? plan) => new
    {
        NombreNegocio = "Negocio Plan", Slug = slug, NombrePropietario = "Duena",
        Email = $"plan-{Guid.NewGuid():N}@ejemplo.com", Contrasena = "Contrasena123!", Sector = "belleza", Plan = plan,
    };

    [Theory]
    [InlineData("pro", "pro")]
    [InlineData(null, null)]
    public async Task Registro_GuardaElPlanElegido(string? plan, string? esperado)
    {
        var slug = $"plan-{Sufijo()}";

        var r = await NewClient().PostAsJsonAsync("/api/publico/registro", Registro(slug, plan));

        r.StatusCode.Should().Be(HttpStatusCode.Created);
        var negocio = await ConDbAsync(async db => await db.Negocios.AsNoTracking().FirstAsync(n => n.Slug == slug));
        negocio.PlanSolicitado.Should().Be(esperado);
        negocio.PlanId.Should().BeNull("the chosen plan is intent only; the SuperAdmin assigns the real plan");
        negocio.Activo.Should().Be(0);
    }

    [Fact]
    public async Task Registro_PlanDesconocido_Retorna400()
    {
        var slug = $"plan-{Sufijo()}";

        var r = await NewClient().PostAsJsonAsync("/api/publico/registro", Registro(slug, "oro"));

        r.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ConDbAsync(db => db.Negocios.AnyAsync(n => n.Slug == slug))).Should().BeFalse();
    }

    // ── B23: activation queue fields ───────────────────────────────────────────

    [Fact]
    public async Task MetricasNegocios_IncluyeFechaCreacionEmailConfirmadoYPlanSolicitado()
    {
        var fecha = new DateTime(2026, 10, 20, 15, 30, 0, DateTimeKind.Utc);
        var conDueno = await CrearNegocioAsync(n => { n.Activo = 0; n.FechaCreacion = fecha; n.PlanSolicitado = "pro"; });
        var sinDueno = await CrearNegocioAsync();
        await using (var scope = Factory.Services.CreateAsyncScope())
        {
            var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var email = $"dueno-{Sufijo()}@ejemplo.com";
            var usuario = new ApplicationUser
            {
                Id = Guid.NewGuid(), UserName = email, Email = email, EmailConfirmed = true, Nombre = "Dueno",
                NegocioId = conDueno.Id, Activo = true, FechaCreacion = DateTime.UtcNow,
            };
            (await um.CreateAsync(usuario, "Contrasena123!")).Succeeded.Should().BeTrue();
            (await um.AddToRoleAsync(usuario, Roles.Propietario)).Succeeded.Should().BeTrue();
        }

        var r = await NewClient(TestTokenHelper.SuperAdmin()).GetAsync("/api/admin/metricas/negocios");

        r.StatusCode.Should().Be(HttpStatusCode.OK);
        var lista = (await JsonAsync(r)).EnumerateArray().ToList();
        var a = lista.Single(e => e.GetProperty("id").GetGuid() == conDueno.Id);
        a.GetProperty("fechaCreacion").GetDateTime().ToUniversalTime().Should().Be(fecha);
        a.GetProperty("emailConfirmado").GetBoolean().Should().BeTrue();
        a.GetProperty("planSolicitado").GetString().Should().Be("pro");
        var b = lista.Single(e => e.GetProperty("id").GetGuid() == sinDueno.Id);
        b.GetProperty("emailConfirmado").ValueKind.Should().Be(JsonValueKind.Null);
    }

    // ── B24: audit filters ─────────────────────────────────────────────────────

    private async Task<(string Marca, Guid UsuarioA)> SembrarAuditoriaAsync()
    {
        var marca = Sufijo();
        var usuarioA = Guid.NewGuid();
        var usuarioB = Guid.NewGuid();
        await using var scope = Factory.Services.CreateAsyncScope();
        var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        foreach (var (id, email) in new[] { (usuarioA, $"Ana.{marca}@Ejemplo.com"), (usuarioB, $"beto.{marca}@ejemplo.com") })
        {
            (await um.CreateAsync(new ApplicationUser
            {
                Id = id, UserName = email, Email = email, Nombre = "U", Activo = true, FechaCreacion = DateTime.UtcNow,
            }, "Contrasena123!")).Succeeded.Should().BeTrue();
        }
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        void Log(Guid usuario, DateTime fecha) => db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), UsuarioId = usuario, Accion = "LoginFallido", FechaEn = fecha,
        });
        Log(usuarioA, new DateTime(2026, 10, 1, 12, 0, 0, DateTimeKind.Utc));
        Log(usuarioA, new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc));
        Log(usuarioB, new DateTime(2026, 10, 10, 13, 0, 0, DateTimeKind.Utc));
        await db.SaveChangesAsync();
        return (marca, usuarioA);
    }

    [Fact]
    public async Task Audit_FiltraPorParteDelCorreoSinDistinguirMayusculas()
    {
        var (marca, usuarioA) = await SembrarAuditoriaAsync();

        var r = await NewClient(TestTokenHelper.SuperAdmin()).GetAsync($"/api/admin/audit?email=ana.{marca.ToUpper()}");

        r.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await JsonAsync(r);
        json.GetProperty("total").GetInt32().Should().Be(2);
        json.GetProperty("datos").EnumerateArray().Should().OnlyContain(e => e.GetProperty("usuarioId").GetGuid() == usuarioA);
    }

    [Fact]
    public async Task Audit_FiltraPorRangoDeFechas_DesdeIncluidoHastaExcluido()
    {
        var (marca, _) = await SembrarAuditoriaAsync();

        var r = await NewClient(TestTokenHelper.SuperAdmin())
            .GetAsync($"/api/admin/audit?email={marca}&desde=2026-10-10T12:00:00Z&hasta=2026-10-10T13:00:00Z");

        r.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await JsonAsync(r);
        json.GetProperty("total").GetInt32().Should().Be(1);
        json.GetProperty("datos")[0].GetProperty("fechaEn").GetDateTime().ToUniversalTime()
            .Should().Be(new DateTime(2026, 10, 10, 12, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public async Task Audit_RangoInvertido_Retorna400()
    {
        var r = await NewClient(TestTokenHelper.SuperAdmin())
            .GetAsync("/api/admin/audit?desde=2026-10-11T00:00:00Z&hasta=2026-10-10T00:00:00Z");

        r.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Audit_FiltroPorCorreo_Propietario_Retorna403()
    {
        var r = await NewClient(TestTokenHelper.Propietario()).GetAsync("/api/admin/audit?email=ana");

        r.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
