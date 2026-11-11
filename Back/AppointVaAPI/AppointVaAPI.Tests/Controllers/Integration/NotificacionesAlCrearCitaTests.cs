using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AppointVaAPI.Data;
using AppointVaAPI.Jobs;
using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;
using FluentAssertions;
using Hangfire;
using Hangfire.Common;
using Hangfire.States;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Xunit;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>
/// Las dos vías de alta de cita —panel y reserva pública— deben avisar igual:
/// correo de confirmación al cliente que tiene email, y push al personal 15
/// minutos antes del inicio, agendado en el instante UTC que corresponde a la
/// hora local del negocio (InicioEn se guarda en hora local, sin Kind).
/// </summary>
public class NotificacionesAlCrearCitaTests : IntegrationTestBase
{
    public NotificacionesAlCrearCitaTests(CustomWebApplicationFactory factory) : base(factory) { }

    private const string ZonaMexico = "Central Standard Time (Mexico)";

    /// <summary>Solo sirve para elegir una fecha local plausible; no entra en ninguna aserción.</summary>
    private static readonly TimeSpan DesfaseAproximado = TimeSpan.FromHours(-6);

    /// <summary>
    /// Desfase real de la zona para esa fecha, leído de la base de zonas del sistema.
    /// Fijarlo en -6 daba por hecho que México no cambia de horario: cierto desde 2022,
    /// pero en un host con una base anterior la prueba fallaría de abril a octubre con
    /// código correcto. Lo que delata el defecto es el par de zonas, no el número: con
    /// el bug los dos negocios caen en el mismo instante.
    /// </summary>
    private static TimeSpan DesfaseDe(string zonaHoraria, DateTime inicioLocal) =>
        AppointVaAPI.Helpers.ZonaHorariaHelper.Resolver(zonaHoraria)
            .GetUtcOffset(DateTime.SpecifyKind(inicioLocal, DateTimeKind.Unspecified));

    private sealed record Semillero(Guid NegocioId, string Slug, Guid ServicioId, Guid EmpleadoId);

    private async Task<Semillero> SembrarAsync(string zonaHoraria = ZonaMexico)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var ahora = DateTime.UtcNow;

        var negocioId = Guid.NewGuid();
        var slug = $"test-notif-cita-{Guid.NewGuid().ToString("N")[..8]}";
        var servicioId = Guid.NewGuid();
        var empleadoId = Guid.NewGuid();

        db.Negocios.Add(new Negocio
        {
            Id                 = negocioId,
            Nombre             = "Test Notificaciones",
            Slug               = slug,
            ZonaHoraria        = zonaHoraria,
            AutoConfirmar      = true,
            Activo             = 1,
            FechaCreacion      = ahora,
            FechaActualizacion = ahora,
        });
        db.Servicios.Add(new Servicio
        {
            Id                 = servicioId,
            NegocioId          = negocioId,
            Nombre             = "Corte",
            DuracionMinutos    = 30,
            BufferMinutos      = 0,
            Precio             = 200m,
            Orden              = 1,
            Activo             = 1,
            FechaCreacion      = ahora,
            FechaActualizacion = ahora,
        });
        db.Empleados.Add(new Empleado
        {
            Id                 = empleadoId,
            NegocioId          = negocioId,
            Nombre             = "Empleado Test",
            Activo             = 1,
            FechaCreacion      = ahora,
            FechaActualizacion = ahora,
        });
        db.EmpleadosServicios.Add(new EmpleadoServicio { EmpleadoId = empleadoId, ServicioId = servicioId });

        // El panel numera los días 1..7 (domingo=7) para el empleado y 0..6 (domingo=0)
        // para el negocio: se siembran ambos rangos para que cualquier fecha sirva.
        for (byte dia = 1; dia <= 7; dia++)
            db.HorariosEmpleados.Add(new HorarioEmpleado
            {
                Id = Guid.NewGuid(), EmpleadoId = empleadoId, DiaSemana = dia,
                HoraInicio = new TimeSpan(8, 0, 0), HoraFin = new TimeSpan(20, 0, 0), Activo = 1,
            });
        for (byte dia = 0; dia <= 6; dia++)
            db.HorariosNegocios.Add(new HorarioNegocio
            {
                Id = Guid.NewGuid(), NegocioId = negocioId, DiaSemana = dia,
                HoraInicio = new TimeSpan(8, 0, 0), HoraFin = new TimeSpan(20, 0, 0), Activo = 1,
            });

        await db.SaveChangesAsync();
        return new Semillero(negocioId, slug, servicioId, empleadoId);
    }

    /// <summary>Hora local del negocio, a tres días vista y dentro del horario laboral.</summary>
    private static DateTime InicioLocal() =>
        DateTime.SpecifyKind(
            (DateTime.UtcNow + DesfaseAproximado).Date.AddDays(3).AddHours(10),
            DateTimeKind.Unspecified);

    /// <summary>Instante UTC en que debe correr el push: inicio local del negocio menos 15 minutos.</summary>
    private static DateTime EsperadoUtc(DateTime inicioLocal, TimeSpan desfaseNegocio) =>
        DateTime.SpecifyKind(
            new DateTimeOffset(inicioLocal, desfaseNegocio).UtcDateTime.AddMinutes(-15),
            DateTimeKind.Utc);

    private IBackgroundJobClient JobClient =>
        Factory.Services.GetRequiredService<IBackgroundJobClient>();

    /// <summary>
    /// Enqueue&lt;T&gt;/Schedule&lt;T&gt; terminan en IBackgroundJobClient.Create(Job, IState).
    /// Se filtra por el id de la cita porque el sustituto es un singleton de la factory
    /// y acumula lo encolado por todas las pruebas de la clase.
    /// </summary>
    private List<(Job Job, IState Estado)> JobsDeLaCita(Guid citaId) =>
        JobClient.ReceivedCalls()
            .Where(c => c.GetMethodInfo().Name == nameof(IBackgroundJobClient.Create))
            .Select(c => ((Job)c.GetArguments()[0]!, (IState)c.GetArguments()[1]!))
            .Where(t => t.Item1.Args.Count > 0 && Equals(t.Item1.Args[0], citaId))
            .ToList();

    private List<(Job Job, IState Estado)> Confirmaciones(Guid citaId) =>
        JobsDeLaCita(citaId)
            .Where(t => t.Job.Type == typeof(NotificacionJob)
                     && t.Job.Method.Name == nameof(NotificacionJob.EnviarConfirmacionAsync))
            .ToList();

    /// <summary>
    /// Todos los push de 15 minutos agendados para la cita, en orden de agendado. Tras un
    /// reagendado hay más de uno (el del alta sigue en cola y se descarta solo por vigencia),
    /// así que mirar el primero no distingue el instante viejo del nuevo.
    /// </summary>
    private List<DateTime?> Push15MinEnqueueAts(Guid citaId) =>
        JobsDeLaCita(citaId)
            .Where(t => t.Job.Type == typeof(IPushService)
                     && t.Job.Method.Name == nameof(IPushService.EnviarRecordatorio15MinAsync))
            .Select(t => (t.Estado as ScheduledState)?.EnqueueAt)
            .ToList();

    private DateTime? Push15MinEnqueueAt(Guid citaId) =>
        Push15MinEnqueueAts(citaId).FirstOrDefault();

    /// <summary>Avisos al personal de que la cita se movió, encolados en el acto.</summary>
    private List<(Job Job, IState Estado)> PushReagendarEmpleado(Guid citaId) =>
        JobsDeLaCita(citaId)
            .Where(t => t.Job.Type == typeof(IPushService)
                     && t.Job.Method.Name == nameof(IPushService.EnviarReagendarEmpleadoAsync))
            .ToList();

    private async Task<(Guid CitaId, HttpResponseMessage Respuesta)> CrearDesdePanelAsync(
        Semillero s, DateTime inicioLocal, string? email, string? telefono = null)
    {
        var client = NewClient(TestTokenHelper.Propietario(s.NegocioId));
        var respuesta = await client.PostAsJsonAsync("/api/citas", new
        {
            servicioId      = s.ServicioId,
            empleadoId      = s.EmpleadoId,
            inicioEn        = inicioLocal,
            nombreCliente   = "Cliente Panel",
            telefonoCliente = telefono ?? $"55{Random.Shared.Next(10_000_000, 99_999_999)}",
            emailCliente    = email,
        });
        respuesta.StatusCode.Should().Be(HttpStatusCode.Created,
            because: await respuesta.Content.ReadAsStringAsync());
        var cuerpo = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        return (cuerpo.GetProperty("id").GetGuid(), respuesta);
    }

    /// <summary>
    /// El alta pública responde un ConfirmacionCitaDto: de ahí salen el id y el código de
    /// confirmación, que es la llave con la que el cliente reagenda desde la página pública.
    /// </summary>
    private async Task<(Guid CitaId, string Codigo)> CrearDesdePublicoAsync(
        Semillero s, DateTime inicioLocal, string? email)
    {
        var client = NewClient();
        var respuesta = await client.PostAsJsonAsync("/api/publico/citas", new
        {
            negocioSlug     = s.Slug,
            servicioId      = s.ServicioId,
            empleadoId      = s.EmpleadoId,
            inicioEn        = inicioLocal,
            nombreCliente   = "Cliente Publico",
            telefonoCliente = $"55{Random.Shared.Next(10_000_000, 99_999_999)}",
            emailCliente    = email,
        });
        respuesta.StatusCode.Should().Be(HttpStatusCode.Created,
            because: await respuesta.Content.ReadAsStringAsync());
        var cuerpo = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        return (cuerpo.GetProperty("id").GetGuid(),
                cuerpo.GetProperty("codigoConfirmacion").GetString()!);
    }

    /// <summary>PATCH api/publico/citas/{codigo}/reagendar?email=... — llave: código + correo del cliente.</summary>
    private async Task<HttpResponseMessage> ReagendarDesdePublicoAsync(
        string codigo, string email, DateTime nuevoInicioLocal)
    {
        var client = NewClient();
        var respuesta = await client.PatchAsJsonAsync(
            $"/api/publico/citas/{codigo}/reagendar?email={Uri.EscapeDataString(email)}",
            new { inicioEn = nuevoInicioLocal });
        respuesta.StatusCode.Should().Be(HttpStatusCode.OK,
            because: await respuesta.Content.ReadAsStringAsync());
        return respuesta;
    }

    // ── Defecto 1: el panel no confirmaba al cliente ──────────────────────────

    [Fact]
    public async Task Panel_ClienteConEmail_EncolaLaConfirmacion()
    {
        var s = await SembrarAsync();

        var (citaId, _) = await CrearDesdePanelAsync(s, InicioLocal(), "panel@test.com");

        var confirmaciones = Confirmaciones(citaId);
        confirmaciones.Should().ContainSingle();
        confirmaciones[0].Job.Args[1].Should().Be("panel@test.com");
    }

    [Fact]
    public async Task Panel_ClienteQueYaTieneCorreo_UsaElDeSuFicha()
    {
        // El caso de todos los días en un salón: una clienta de siempre a la que se le
        // agenda por teléfono sin volver a escribir su correo. La confirmación tiene que
        // salir al que ya está en su ficha, no quedarse sin enviar.
        var s = await SembrarAsync();
        var telefono = $"55{Random.Shared.Next(10_000_000, 99_999_999)}";
        var inicio = InicioLocal();

        await CrearDesdePanelAsync(s, inicio, "ficha@test.com", telefono);
        var (segunda, _) = await CrearDesdePanelAsync(s, inicio.AddHours(2), null, telefono);

        var confirmaciones = Confirmaciones(segunda);
        confirmaciones.Should().ContainSingle();
        confirmaciones[0].Job.Args[1].Should().Be("ficha@test.com",
            "el correo de la ficha cubre a quien se agenda sin volver a escribirlo");
    }

    [Fact]
    public async Task SinEmail_NiElPanelNiElPublicoEncolanConfirmacion()
    {
        var s = await SembrarAsync();
        var inicio = InicioLocal();

        var (citaPanel, _) = await CrearDesdePanelAsync(s, inicio, null);
        var (citaPublica, _) = await CrearDesdePublicoAsync(s, inicio.AddHours(1), null);

        Confirmaciones(citaPanel).Should().BeEmpty();
        Confirmaciones(citaPublica).Should().BeEmpty();
    }

    // ── Defecto 2: el push de 15 minutos se agendaba en hora local ────────────

    // Se reserva la misma hora de pared en dos negocios de zonas distintas. Agendar
    // con el valor local crudo lo convierte con la zona de la máquina, así que los dos
    // instantes saldrían iguales: la pareja delata el defecto corra donde corra la suite
    // (en un host UTC-6 el caso de México solo pasaría por coincidencia).

    [Fact]
    public async Task Publico_AgendaElPushDeQuinceMinutosEnElInstanteUtcCorrecto()
    {
        var mexico = await SembrarAsync(ZonaMexico);
        var utc = await SembrarAsync("UTC");
        var inicio = InicioLocal();

        var (citaMexico, _) = await CrearDesdePublicoAsync(mexico, inicio, "publico@test.com");
        var (citaUtc, _) = await CrearDesdePublicoAsync(utc, inicio, "publico@test.com");

        var esperadoMexico = EsperadoUtc(inicio, DesfaseDe(ZonaMexico, inicio));
        var esperadoUtc = EsperadoUtc(inicio, TimeSpan.Zero);
        esperadoMexico.Should().NotBe(esperadoUtc,
            "si la zona de México no resuelve en este host, Resolver cae a TimeZoneInfo.Utc, " +
            "los dos esperados colapsan en el mismo instante y el par deja de distinguir el defecto");

        Push15MinEnqueueAt(citaMexico).Should().Be(esperadoMexico);
        Push15MinEnqueueAt(citaUtc).Should().Be(esperadoUtc);
    }

    [Fact]
    public async Task PublicoReagendar_RearmaElPushDeQuinceMinutosParaElNuevoInicio()
    {
        // El job agendado al reservar apunta a la hora vieja y se autodescarta por vigencia,
        // así que si el reagendado público no lo rearma el personal se queda sin aviso.
        var s = await SembrarAsync(ZonaMexico);
        var inicio = InicioLocal();
        var nuevoInicio = inicio.AddHours(2);

        var (citaId, codigo) = await CrearDesdePublicoAsync(s, inicio, "publico@test.com");
        await ReagendarDesdePublicoAsync(codigo, "publico@test.com", nuevoInicio);

        var esperadoOriginal = EsperadoUtc(inicio, DesfaseDe(ZonaMexico, inicio));
        var esperadoNuevo = EsperadoUtc(nuevoInicio, DesfaseDe(ZonaMexico, nuevoInicio));
        esperadoNuevo.Should().NotBe(esperadoOriginal, "el nuevo inicio se eligió dos horas después");

        // Quedan dos push para la misma cita; el orden de agendado separa el del alta del
        // rearmado, así que la aserción no puede satisfacerse leyendo el original.
        var instantes = Push15MinEnqueueAts(citaId);
        instantes.Should().HaveCount(2,
            "al reagendar debe agendarse un push nuevo además del que quedó del alta");
        instantes[0].Should().Be(esperadoOriginal);
        instantes[1].Should().Be(esperadoNuevo,
            "el push rearmado apunta al nuevo inicio convertido a UTC con la zona del negocio");
    }

    [Fact]
    public async Task PublicoReagendar_ANuevoInicioMuyCercano_NoAgendaOtroPush()
    {
        // El instante de disparo ya pasó, así que agendarlo haría que Hangfire lo corriera
        // de inmediato y el personal recibiera "en 15 minutos" con la cita encima.
        var s = await SembrarAsync(ZonaMexico);
        var tz = AppointVaAPI.Helpers.ZonaHorariaHelper.Resolver(ZonaMexico);
        var nuevoInicio = DateTime.SpecifyKind(
            TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz).AddMinutes(10),
            DateTimeKind.Unspecified);

        var (citaId, codigo) = await CrearDesdePublicoAsync(s, InicioLocal(), "publico@test.com");
        await ReagendarDesdePublicoAsync(codigo, "publico@test.com", nuevoInicio);

        Push15MinEnqueueAts(citaId).Should().ContainSingle(
            "solo queda el del alta: a menos de 15 minutos no hay nada que agendar");
    }

    [Fact]
    public async Task PublicoReagendar_AvisaAlPersonalEnElActo()
    {
        // Antes el reagendado público solo encolaba el correo al cliente y el push de 15
        // minutos, así que una cita movida de jueves a viernes no se conocía en el negocio
        // hasta un cuarto de hora antes del nuevo horario.
        var s = await SembrarAsync(ZonaMexico);
        var inicio = InicioLocal();

        var (citaId, codigo) = await CrearDesdePublicoAsync(s, inicio, "publico@test.com");
        await ReagendarDesdePublicoAsync(codigo, "publico@test.com", inicio.AddHours(2));

        PushReagendarEmpleado(citaId).Should().ContainSingle();
    }

    [Fact]
    public async Task Panel_AgendaElPushDeQuinceMinutosEnElInstanteUtcCorrecto()
    {
        var mexico = await SembrarAsync(ZonaMexico);
        var utc = await SembrarAsync("UTC");
        var inicio = InicioLocal();

        var (citaMexico, _) = await CrearDesdePanelAsync(mexico, inicio, "panel@test.com");
        var (citaUtc, _) = await CrearDesdePanelAsync(utc, inicio, "panel@test.com");

        var esperadoMexico = EsperadoUtc(inicio, DesfaseDe(ZonaMexico, inicio));
        var esperadoUtc = EsperadoUtc(inicio, TimeSpan.Zero);
        esperadoMexico.Should().NotBe(esperadoUtc,
            "si la zona de México no resuelve en este host, Resolver cae a TimeZoneInfo.Utc, " +
            "los dos esperados colapsan en el mismo instante y el par deja de distinguir el defecto");

        Push15MinEnqueueAt(citaMexico).Should().Be(esperadoMexico);
        Push15MinEnqueueAt(citaUtc).Should().Be(esperadoUtc);
    }
}
