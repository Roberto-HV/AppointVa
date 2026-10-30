using AppointVaAPI.Models;
using AppointVaAPI.Services;
using AppointVaAPI.Constants;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using NSubstitute;

namespace AppointVaAPI.Tests.Services;

/// <summary>
/// Tests for the 9 internal static Plantilla* methods in EmailService.
/// Called directly (InternalsVisibleTo) so a signature change breaks the build
/// instead of failing at runtime — no network calls involved.
/// </summary>
public class EmailTemplatesTests
{
    // ─── helpers ────────────────────────────────────────────────────────────

    private static Cita BuildCita(
        string negocioNombre  = "Salón Prueba",
        string servicioNombre = "Corte de cabello",
        string? empleadoNombre = "Ana López",
        string codigo         = "ABC123",
        byte estado           = EstadosCitas.Confirmada,
        string? motivoCancelacion = null)
    {
        var inicio = new DateTime(2026, 8, 10, 10, 0, 0, DateTimeKind.Utc);
        return new Cita
        {
            Id                  = Guid.NewGuid(),
            NegocioId           = Guid.NewGuid(),
            ClienteId           = Guid.NewGuid(),
            EmpleadoId          = Guid.NewGuid(),
            ServicioId          = Guid.NewGuid(),
            CodigoConfirmacion  = codigo,
            InicioEn            = inicio,
            FinEn               = inicio.AddHours(1),
            Estado              = estado,
            Precio              = 250m,
            FechaCreacion       = DateTime.UtcNow,
            FechaActualizacion  = DateTime.UtcNow,
            MotivoCancelacion   = motivoCancelacion,
            Negocio  = new Negocio  { Nombre = negocioNombre },
            Servicio = new Servicio { Nombre = servicioNombre },
            Empleado = empleadoNombre is null
                ? null
                : new Empleado { Nombre = empleadoNombre }
        };
    }

    // ─── PlantillaConfirmacion ───────────────────────────────────────────────

    [Fact]
    public void PlantillaConfirmacion_Confirmada_ContainsExpectedContent()
    {
        var cita = BuildCita();
        var html = EmailService.PlantillaConfirmacion(cita, "Carlos", null, null, null, null, false);

        html.Should().Contain("Appoint");
        html.Should().Contain("Va");
        html.Should().Contain("✅");
        html.Should().Contain("¡Tu cita está confirmada!");
        html.Should().Contain("Salón Prueba");
        html.Should().Contain("Corte de cabello");
        html.Should().Contain("ABC123");
        html.Should().Contain("#10b981");
    }

    [Fact]
    public void PlantillaConfirmacion_Pendiente_ContainsAmberStripeAndPendingTitle()
    {
        var cita = BuildCita(estado: EstadosCitas.Pendiente);
        var html = EmailService.PlantillaConfirmacion(cita, "Carlos", null, null, null, null, true);

        html.Should().Contain("⏳");
        html.Should().Contain("Solicitud de cita recibida");
        html.Should().Contain("#f59e0b");
        html.Should().NotContain("Ver mi cita →");
    }

    [Fact]
    public void PlantillaConfirmacion_ConUrlCita_ContainsVerMiCita()
    {
        var cita = BuildCita();
        var html = EmailService.PlantillaConfirmacion(cita, "Carlos", "https://appointva.com/cita/1", null, null, null, false);

        html.Should().Contain("Ver mi cita →");
        html.Should().Contain("https://appointva.com/cita/1");
    }

    [Fact]
    public void PlantillaConfirmacion_ConEmpleado_ContainsEmpleadoName()
    {
        var cita = BuildCita(empleadoNombre: "Ana López");
        var html = EmailService.PlantillaConfirmacion(cita, "Carlos", null, null, null, null, false);

        html.Should().Contain("Atendido por");
        html.Should().Contain("Ana López");
    }

    [Fact]
    public void PlantillaConfirmacion_SinEmpleado_OmitsAtendidoPor()
    {
        var cita = BuildCita(empleadoNombre: null);
        var html = EmailService.PlantillaConfirmacion(cita, "Carlos", null, null, null, null, false);

        html.Should().NotContain("Atendido por");
    }

    [Fact]
    public void PlantillaConfirmacion_ConCalendario_ContainsCalendarLinks()
    {
        var cita = BuildCita();
        var html = EmailService.PlantillaConfirmacion(cita, "Carlos",
            null,
            "https://cal.example.com/ical",
            "https://cal.example.com/google",
            null,
            false);

        html.Should().Contain("Google Calendar");
        html.Should().Contain("iCal / Apple");
    }

    [Fact]
    public void PlantillaConfirmacion_PendienteConCalendario_OmitsCalendarLinks()
    {
        var cita = BuildCita(estado: EstadosCitas.Pendiente);
        var html = EmailService.PlantillaConfirmacion(cita, "Carlos",
            null,
            "https://cal.example.com/ical",
            "https://cal.example.com/google",
            null,
            true);

        // Calendar links only appear when NOT pending
        html.Should().NotContain("Google Calendar");
        html.Should().NotContain("iCal / Apple");
    }

    [Fact]
    public void PlantillaConfirmacion_ConCancelacion_ContainsCancelarLink()
    {
        var cita = BuildCita();
        var html = EmailService.PlantillaConfirmacion(cita, "Carlos",
            null, null, null,
            "https://appointva.com/cancelar/1",
            false);

        html.Should().Contain("Cancelar mi cita");
        html.Should().Contain("https://appointva.com/cancelar/1");
    }

    // ─── PlantillaCancelacion ────────────────────────────────────────────────

    [Fact]
    public void PlantillaCancelacion_ContainsExpectedContent()
    {
        var cita = BuildCita(servicioNombre: "Manicure");
        var html = EmailService.PlantillaCancelacion(cita, "Lucía");

        html.Should().Contain("❌");
        html.Should().Contain("Tu cita fue cancelada");
        html.Should().Contain("#ef4444");
        html.Should().Contain("Manicure");
    }

    [Fact]
    public void PlantillaCancelacion_ConMotivo_ContainsMotivoBlock()
    {
        var cita = BuildCita(motivoCancelacion: "El negocio cerró ese día");
        var html = EmailService.PlantillaCancelacion(cita, "Lucía");

        html.Should().Contain("Motivo de cancelación");
        html.Should().Contain("El negocio cerró ese día");
    }

    [Fact]
    public void PlantillaCancelacion_SinMotivo_OmitsMotivoBlock()
    {
        var cita = BuildCita(motivoCancelacion: null);
        var html = EmailService.PlantillaCancelacion(cita, "Lucía");

        html.Should().NotContain("Motivo de cancelación");
    }

    // ─── PlantillaRecordatorio ───────────────────────────────────────────────

    [Fact]
    public void PlantillaRecordatorio_ContainsExpectedContent()
    {
        var cita = BuildCita(codigo: "XYZ789");
        var html = EmailService.PlantillaRecordatorio(cita, "Pedro", "mañana", null, null);

        html.Should().Contain("⏰");
        html.Should().Contain("Recordatorio de cita");
        html.Should().Contain("<strong>mañana</strong>");
        html.Should().Contain("#f59e0b");
        html.Should().Contain("Corte de cabello");
        html.Should().Contain("XYZ789");
    }

    [Fact]
    public void PlantillaRecordatorio_ConGoogleCal_ContainsCalendarLink()
    {
        var cita = BuildCita();
        var html = EmailService.PlantillaRecordatorio(cita, "Pedro", "hoy", null, "https://cal.example.com/google");

        html.Should().Contain("Google Calendar");
    }

    // ─── PlantillaReagendar ──────────────────────────────────────────────────

    [Fact]
    public void PlantillaReagendar_ContainsExpectedContent()
    {
        var cita = BuildCita(codigo: "RRR999");
        var fechaOriginal = new DateTime(2026, 8, 5, 9, 0, 0, DateTimeKind.Utc);
        var html = EmailService.PlantillaReagendar(cita, "Marta", fechaOriginal);

        html.Should().Contain("🔄");
        html.Should().Contain("Tu cita fue reagendada");
        html.Should().Contain("#3b82f6");
        html.Should().Contain("line-through");
        html.Should().Contain("Nueva fecha");
        html.Should().Contain("RRR999");
    }

    // ─── PlantillaSolicitudResena ────────────────────────────────────────────

    [Fact]
    public void PlantillaSolicitudResena_ContainsExpectedContent()
    {
        var cita = BuildCita(negocioNombre: "Peluquería Estilo");
        var html = EmailService.PlantillaSolicitudResena(cita, "Valentina", "https://appointva.com/resena/abc");

        html.Should().Contain("⭐");
        html.Should().Contain("¿Cómo fue tu experiencia?");
        html.Should().Contain("#c8a961");
        html.Should().Contain("Dejar mi reseña →");
        html.Should().Contain("https://appointva.com/resena/abc");
    }

    // ─── PlantillaListaEspera ────────────────────────────────────────────────

    [Fact]
    public void PlantillaListaEspera_ContainsExpectedContent()
    {
        var html = EmailService.PlantillaListaEspera(
"Roberto", "Spa Zen", "Masaje", "https://appointva.com/reservar/abc");

        html.Should().Contain("🎉");
        html.Should().Contain("¡Hay un lugar disponible!");
        html.Should().Contain("#22c55e");
        html.Should().Contain("Reservar mi lugar →");
        html.Should().Contain("Spa Zen");
        html.Should().Contain("Masaje");
        html.Should().Contain("https://appointva.com/reservar/abc");
    }

    // ─── PlantillaRecuperacion ───────────────────────────────────────────────

    [Fact]
    public void PlantillaRecuperacion_ContainsExpectedContent()
    {
        var url = "https://appointva.com/reset?token=abc123";
        var html = EmailService.PlantillaRecuperacion("Sofía", url);

        html.Should().Contain("🔑");
        html.Should().Contain("Recupera tu contraseña");
        html.Should().Contain("#8b5cf6");
        html.Should().Contain("Restablecer contraseña →");
        html.Should().Contain(url);
        // Fallback plain-text URL for users where the button doesn't work
        html.Should().Contain("copia este enlace");
    }

    // ─── PlantillaVerificacion ───────────────────────────────────────────────

    [Fact]
    public void PlantillaVerificacion_ContainsExpectedContent()
    {
        var url = "https://appointva.com/verify?token=xyz";
        var html = EmailService.PlantillaVerificacion("Diego", url);

        html.Should().Contain("✉️");
        html.Should().Contain("Verifica tu correo electrónico");
        html.Should().Contain("#c8a961");
        html.Should().Contain("Verificar mi correo →");
        html.Should().Contain(url);
    }

    // ─── PlantillaBienvenida ─────────────────────────────────────────────────

    [Fact]
    public void PlantillaBienvenida_ContainsExpectedContent()
    {
        var urlDash = "https://appointva.com/dashboard";
        var urlRes  = "https://appointva.com/b/mi-negocio";
        var html = EmailService.PlantillaBienvenida("Jorge", "Barbería Classic", urlRes, urlDash);

        html.Should().Contain("🎉");
        html.Should().Contain("¡Bienvenido a AppointVa");
        html.Should().Contain("#c8a961");
    }

    [Fact]
    public void PlantillaBienvenida_ContainsThreeSteps()
    {
        var html = EmailService.PlantillaBienvenida("Jorge", "Barbería Classic",
            "https://appointva.com/b/mi-negocio", "https://appointva.com/dashboard");

        // The numbered step boxes render ">1<", ">2<", ">3<" inside a div
        html.Should().Contain(">1<");
        html.Should().Contain(">2<");
        html.Should().Contain(">3<");
    }

    [Fact]
    public void PlantillaBienvenida_ContainsTipEmojis()
    {
        var html = EmailService.PlantillaBienvenida("Jorge", "Barbería Classic",
            "https://appointva.com/b/mi-negocio", "https://appointva.com/dashboard");

        html.Should().Contain("📸");
        html.Should().Contain("💬");
        html.Should().Contain("⏰");
    }

    [Fact]
    public void PlantillaBienvenida_ContainsDashboardLinkAndSupportEmail()
    {
        var urlDash = "https://appointva.com/dashboard";
        var html = EmailService.PlantillaBienvenida("Jorge", "Barbería Classic",
            "https://appointva.com/b/mi-negocio", urlDash);

        html.Should().Contain("Ir a mi panel →");
        html.Should().Contain(urlDash);
        html.Should().Contain("hola@appointva.com");
    }

    // ─── HTML injection ──────────────────────────────────────────────────────

    private const string NombreMalicioso  = "<b>Ana</b><script>x</script>";
    private const string NombreCodificado = "&lt;b&gt;Ana&lt;/b&gt;&lt;script&gt;x&lt;/script&gt;";

    public static IEnumerable<object[]> PlantillasConNombreMalicioso()
    {
        var cita = BuildCita();
        yield return new object[] { "ticket", EmailService.PlantillaTicket(
            NombreMalicioso, "Salón Prueba", "Corte", cita.InicioEn, 250m, "Efectivo", null) };
        yield return new object[] { "confirmacion", EmailService.PlantillaConfirmacion(
            cita, NombreMalicioso, null, null, null, null, false) };
        yield return new object[] { "cancelacion", EmailService.PlantillaCancelacion(cita, NombreMalicioso) };
        yield return new object[] { "recordatorio", EmailService.PlantillaRecordatorio(
            cita, NombreMalicioso, "mañana", null, null) };
        yield return new object[] { "reagendar", EmailService.PlantillaReagendar(
            cita, NombreMalicioso, cita.InicioEn.AddDays(-1)) };
    }

    [Theory]
    [MemberData(nameof(PlantillasConNombreMalicioso))]
    public void Plantillas_EncodeClientName(string plantilla, string html)
    {
        html.Should().NotContain("<script>", because: $"the {plantilla} template must encode the client name");
        html.Should().NotContain("<b>Ana</b>", because: $"the {plantilla} template must encode the client name");
        html.Should().Contain(NombreCodificado, because: $"the {plantilla} template must show the name as text");
    }

    [Fact]
    public void Plantillas_EncodeBusinessServiceEmployeeAndReason()
    {
        var cita = BuildCita(
            negocioNombre: "<i>Neg</i>",
            servicioNombre: "<img src=x onerror=alert(1)>",
            empleadoNombre: "\"Emp\" & 'Co'",
            motivoCancelacion: "<a href=\"https://evil\">clic</a>");

        var cancelacion = EmailService.PlantillaCancelacion(cita, "Ana");
        cancelacion.Should().NotContain("<i>Neg</i>");
        cancelacion.Should().Contain("&lt;i&gt;Neg&lt;/i&gt;");
        cancelacion.Should().NotContain("<img src=x");
        cancelacion.Should().NotContain("<a href=\"https://evil\">");
        cancelacion.Should().Contain("&lt;a href=&quot;https://evil&quot;&gt;clic&lt;/a&gt;");

        var confirmacion = EmailService.PlantillaConfirmacion(cita, "Ana", null, null, null, null, false);
        confirmacion.Should().Contain("&quot;Emp&quot; &amp; &#39;Co&#39;");
    }

    [Fact]
    public void Plantillas_KeepAccentsReadable()
    {
        var html = EmailService.PlantillaConfirmacion(BuildCita(), "José Núñez", null, null, null, null, false);

        html.Should().Contain("José Núñez");
        html.Should().Contain("Salón Prueba");
    }

    [Fact]
    public void Plantillas_UrlWithQueryString_IsAttributeEncodedAndStillAValidLink()
    {
        var url = "https://cal.example.com/ical?id=1&token=abc";
        var html = EmailService.PlantillaConfirmacion(BuildCita(), "Ana", null, url, null, null, false);

        // &amp; inside an attribute is decoded back to & by every HTML parser.
        html.Should().Contain("href=\"https://cal.example.com/ical?id=1&amp;token=abc\"");
        System.Net.WebUtility.HtmlDecode("https://cal.example.com/ical?id=1&amp;token=abc").Should().Be(url);
    }

    [Fact]
    public void Plantillas_UrlCannotBreakOutOfHrefAttribute()
    {
        var html = EmailService.PlantillaSolicitudResena(BuildCita(), "Ana", "https://x\" onclick=\"alert(1)");

        html.Should().NotContain("\" onclick=\"");
        html.Should().Contain("href=\"https://x&quot; onclick=&quot;alert(1)\"");
    }

    // ─── Hour format ─────────────────────────────────────────────────────────

    [Theory]
    [InlineData(16, 0, "4:00 p.m.")]
    [InlineData(9, 5, "9:05 a.m.")]
    [InlineData(0, 0, "12:00 a.m.")]
    [InlineData(12, 30, "12:30 p.m.")]
    public void Hora12_UsesSpanishPeriods(int hora, int minuto, string esperado)
    {
        EmailService.Hora12(new DateTime(2026, 8, 10, hora, minuto, 0)).Should().Be(esperado);
    }

    [Fact]
    public void Plantillas_RenderSpanishTime_WithoutTimeZoneConversion()
    {
        var cita = BuildCita();
        cita.InicioEn = new DateTime(2026, 8, 10, 16, 0, 0, DateTimeKind.Utc);
        cita.FinEn    = cita.InicioEn.AddHours(1);

        var ticket = EmailService.PlantillaTicket("Ana", "Salón", "Corte",
            new DateTime(2026, 8, 10, 9, 5, 0), 100m, "Efectivo", null);
        ticket.Should().Contain("9:05 a.m.");
        ticket.Should().NotContain("AM");

        EmailService.PlantillaConfirmacion(cita, "Ana", null, null, null, null, false).Should().Contain("4:00 p.m.");
        EmailService.PlantillaCancelacion(cita, "Ana").Should().Contain("4:00 p.m.");
        EmailService.PlantillaRecordatorio(cita, "Ana", "hoy", null, null).Should().Contain("4:00 p.m.");
        EmailService.PlantillaReagendar(cita, "Ana", cita.InicioEn.AddDays(-1))
            .Should().Contain("4:00 p.m. – 5:00 p.m.");
    }

    // ─── Subject header injection ────────────────────────────────────────────

    [Fact]
    public void LimpiarAsunto_RemovesCrLf()
    {
        EmailService.LimpiarAsunto("Recibo de pago — Salón\r\nBcc: x@evil.com")
            .Should().Be("Recibo de pago — Salón Bcc: x@evil.com");
    }

    [Fact]
    public async Task EnviarTicketCitaAsync_CrLfInBusinessName_DoesNotReachSubject()
    {
        var (service, handler) = BuildService();

        await service.EnviarTicketCitaAsync("ana@example.com", "Ana", "Salón\r\nBcc: x@evil.com",
            "Corte", new DateTime(2026, 8, 10, 16, 0, 0), 100m, "Efectivo", null);

        handler.Subject.Should().NotBeNull();
        handler.Subject.Should().NotContainAny("\r", "\n");
        handler.Subject.Should().Be("Recibo de pago — Salón Bcc: x@evil.com");
    }

    [Fact]
    public async Task EnviarCancelacionCitaAsync_CrLfInServiceName_DoesNotReachSubject()
    {
        var (service, handler) = BuildService();
        var cita = BuildCita(servicioNombre: "Corte\nBcc: x@evil.com");
        cita.NegocioId = Guid.Empty; // skip EmailLog registration

        await service.EnviarCancelacionCitaAsync(cita, "ana@example.com", "Ana");

        handler.Subject.Should().NotBeNull();
        handler.Subject.Should().NotContainAny("\r", "\n");
        handler.Subject.Should().Be("Cita cancelada — Corte Bcc: x@evil.com");
    }

    private static (EmailService, CapturingHandler) BuildService()
    {
        var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Email:Habilitado"] = "true",
                ["Email:ApiKey"]     = "test-key",
            })
            .Build();
        var handler = new CapturingHandler();
        var factory = NSubstitute.Substitute.For<IHttpClientFactory>();
        factory.CreateClient("Brevo").Returns(_ => new HttpClient(handler));
        var scopeFactory = NSubstitute.Substitute.For<Microsoft.Extensions.DependencyInjection.IServiceScopeFactory>();
        var service = new EmailService(config,
            Microsoft.Extensions.Logging.Abstractions.NullLogger<EmailService>.Instance,
            scopeFactory, factory);
        return (service, handler);
    }

    private sealed class CapturingHandler : HttpMessageHandler
    {
        public string? Subject { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var json = await request.Content!.ReadAsStringAsync(cancellationToken);
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            Subject = doc.RootElement.GetProperty("subject").GetString();
            return new HttpResponseMessage(System.Net.HttpStatusCode.Created);
        }
    }
}
