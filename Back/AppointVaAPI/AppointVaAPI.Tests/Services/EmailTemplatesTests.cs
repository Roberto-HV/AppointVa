using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Citas;
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
            Ticket() with { ClienteNombre = NombreMalicioso }) };
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

        var ticket = EmailService.PlantillaTicket(Ticket() with { InicioEn = new DateTime(2026, 8, 10, 9, 5, 0) });
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
        EmailService.LimpiarAsunto("Comprobante de pago — Salón\r\nBcc: x@evil.com")
            .Should().Be("Comprobante de pago — Salón Bcc: x@evil.com");
    }

    [Fact]
    public async Task EnviarTicketCitaAsync_CrLfInBusinessName_DoesNotReachSubject()
    {
        var (service, handler) = BuildService();

        await service.EnviarTicketCitaAsync("ana@example.com",
            Ticket() with { NegocioNombre = "Salón\r\nBcc: x@evil.com" });

        handler.Subject.Should().NotBeNull();
        handler.Subject.Should().NotContainAny("\r", "\n");
        handler.Subject.Should().Be("Comprobante de pago — Salón Bcc: x@evil.com");
    }

    // ─── PlantillaTicket ─────────────────────────────────────────────────────

    /// <summary>A plain cash payment, no discount, no advance, no tip.</summary>
    private static TicketCitaDatos Ticket() => new()
    {
        ClienteNombre   = "Ana García",
        NegocioNombre   = "Salón Aramis",
        Folio           = "A1B2C3D4",
        InicioEn        = new DateTime(2026, 10, 30, 16, 0, 0),
        EmpleadoNombre  = "Sofía Hernández",
        Servicio        = "Corte de dama",
        DuracionMinutos = 45,
        Precio          = 280m,
        PrecioLista     = 280m,
        MontoCobrado    = 280m,
        MetodoPago      = "Tarjeta",
    };

    [Fact]
    public void PlantillaTicket_ShowsHeaderFolioDateEmployeeAndServiceWithDuration()
    {
        var html = EmailService.PlantillaTicket(Ticket() with
        {
            NegocioLogoUrl   = "https://res.cloudinary.com/demo/logo.png",
            NegocioDireccion = "Av. Juárez 120, Centro",
            NegocioTelefono  = "55 1234 5678",
            UrlReserva       = "https://appointva.com/b/salon-aramis",
        });

        html.Should().Contain("Comprobante de pago");
        html.Should().Contain("<img src=\"https://res.cloudinary.com/demo/logo.png\"");
        html.Should().Contain("Salón Aramis");
        html.Should().Contain("Av. Juárez 120, Centro");
        html.Should().Contain("Tel. 55 1234 5678");
        html.Should().Contain("A1B2C3D4");
        html.Should().Contain("4:00 p.m.");
        html.Should().Contain(">Atendió<");
        html.Should().Contain("Sofía Hernández");
        html.Should().Contain("Corte de dama");
        html.Should().Contain(" · 45 min");
        html.Should().Contain("$280.00");
        html.Should().Contain("href=\"https://appointva.com/b/salon-aramis\"");
        html.Should().Contain("Reserva tu próxima cita");
        html.Should().Contain("Gracias por tu visita");
        html.Should().Contain("Agenda en línea con");
        html.Should().Contain("appointva.com");
    }

    [Fact]
    public void PlantillaTicket_WithoutOptionalData_HidesTheirRows()
    {
        var html = EmailService.PlantillaTicket(Ticket() with { EmpleadoNombre = null });

        html.Should().NotContain("<img");
        html.Should().NotContain("Tel. ");
        html.Should().NotContain("Atendió");
        html.Should().NotContain("Subtotal");
        html.Should().NotContain("Descuento");
        html.Should().NotContain("Anticipo pagado");
        html.Should().NotContain("Propina");
        html.Should().NotContain("Recibido");
        html.Should().NotContain("Cambio");
        html.Should().NotContain("Reserva tu próxima cita");
        html.Should().Contain("Gracias por tu visita");
    }

    [Fact]
    public void PlantillaTicket_HealthSector_UsesProfesional()
    {
        var html = EmailService.PlantillaTicket(Ticket() with { Sector = "salud" });

        html.Should().Contain(">Profesional<");
        html.Should().NotContain("Atendió");
    }

    [Fact]
    public void PlantillaTicket_CouponCashAndTip_RowsCloseOnPaper()
    {
        // 10% coupon at booking (300 → 270), cash 300 received, change 30, tip 40.
        var html = EmailService.PlantillaTicket(Ticket() with
        {
            Precio         = 270m,
            PrecioLista    = 300m,
            DescuentoPorcentaje = 10m,
            MontoCobrado   = 270m,
            MetodoPago     = "Efectivo",
            MontoRecibido  = 300m,
            Cambio         = 30m,
            Propina        = 40m,
        });

        html.Should().Contain("Subtotal");
        html.Should().Contain("$300.00");
        html.Should().Contain("Descuento 10%");
        html.Should().Contain("-$30.00");
        html.Should().Contain("$270.00");
        html.Should().Contain(">Recibido<");
        html.Should().Contain(">Cambio<");
        html.Should().Contain(">Propina<");
        html.Should().Contain("$40.00");
        html.Should().NotContain("Anticipo pagado");
    }

    [Fact]
    public void PlantillaTicket_AdvanceAndSplitPayment_ShowsBothMethods()
    {
        // 1,200 service, 300 advance already paid, 900 charged: 500 card + 400 transfer.
        var html = EmailService.PlantillaTicket(Ticket() with
        {
            Precio         = 1200m,
            PrecioLista    = 1200m,
            AnticipoRecibido = true,
            MontoAnticipo  = 300m,
            MontoCobrado   = 900m,
            MetodoPago     = "Tarjeta",
            MetodoPago2    = "Transferencia",
            MontoPago2     = 400m,
        });

        html.Should().Contain("Subtotal");
        html.Should().Contain("$1,200.00");
        html.Should().Contain("Anticipo pagado");
        html.Should().Contain("-$300.00");
        html.Should().Contain("$900.00");
        html.Should().Contain(">Tarjeta<");
        html.Should().Contain("$500.00");
        html.Should().Contain(">Transferencia<");
        html.Should().Contain("$400.00");
        html.Should().NotContain("Descuento");
        html.Should().NotContain("Recibido");
    }

    [Fact]
    public void ResumirTicket_ChargedLessThanExpected_CountsTheDifferenceAsDiscount()
    {
        var r = EmailService.ResumirTicket(Ticket() with { AnticipoRecibido = true, MontoAnticipo = 100m, MontoCobrado = 150m });

        r.PrecioLista.Should().Be(280m);
        r.Anticipo.Should().Be(100m);
        r.DescuentoCupon.Should().Be(0m);
        r.DescuentoCaja.Should().Be(30m);
        r.CargoAdicional.Should().Be(0m);
        (r.PrecioLista - r.DescuentoCupon - r.DescuentoCaja - r.Anticipo + r.CargoAdicional).Should().Be(r.Total);
    }

    [Fact]
    public void ResumirTicket_ListPriceBelowPrice_NeverShowsANegativeDiscount()
    {
        var r = EmailService.ResumirTicket(Ticket() with { PrecioLista = 250m });

        r.PrecioLista.Should().Be(280m);
        r.DescuentoCupon.Should().Be(0m);
        r.Totales.Should().BeEmpty();
    }

    [Fact]
    public void PlantillaTicket_AdvanceLargerThanDue_ShowsSaldoAFavorAndNoSurcharge()
    {
        var html = EmailService.PlantillaTicket(Ticket() with
        {
            Precio = 200m, PrecioLista = 200m, AnticipoRecibido = true, MontoAnticipo = 300m,
            MontoCobrado = null, MetodoPago = "Efectivo",
        });

        html.Should().Contain("Anticipo aplicado");
        html.Should().Contain("-$200.00");
        html.Should().Contain(">Saldo a favor<");
        html.Should().Contain("$100.00");
        html.Should().NotContain("Cargo adicional");
    }

    [Fact]
    public void PlantillaTicket_LegacyAppointmentWithoutStoredListPrice_ShowsNoCoupon()
    {
        var html = EmailService.PlantillaTicket(Ticket() with { PrecioLista = null, DescuentoPorcentaje = null });

        html.Should().NotContain("Descuento");
        html.Should().NotContain("Subtotal");
    }

    [Fact]
    public void PlantillaTicket_EncodesEveryTextValue()
    {
        const string ataque = "<script>alert(1)</script>";
        var html = EmailService.PlantillaTicket(Ticket() with
        {
            NegocioNombre    = ataque,
            NegocioDireccion = ataque,
            NegocioTelefono  = ataque,
            Folio            = ataque,
            EmpleadoNombre   = ataque,
            Servicio         = ataque,
            MetodoPago       = ataque,
            MetodoPago2      = ataque,
            MontoPago2       = 10m,
            NegocioLogoUrl   = "https://x\" onerror=\"alert(1)",
            UrlReserva       = "https://x\" onclick=\"alert(1)",
        });

        html.Should().NotContain("<script>");
        html.Should().Contain("&lt;script&gt;alert(1)&lt;/script&gt;");
        html.Should().NotContain("\" onerror=\"");
        html.Should().NotContain("\" onclick=\"");
    }

    [Fact]
    public void PlantillaTicket_NonHttpLogo_IsNotRendered()
    {
        var html = EmailService.PlantillaTicket(Ticket() with { NegocioLogoUrl = "javascript:alert(1)" });

        html.Should().NotContain("<img");
        html.Should().NotContain("javascript:");
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
