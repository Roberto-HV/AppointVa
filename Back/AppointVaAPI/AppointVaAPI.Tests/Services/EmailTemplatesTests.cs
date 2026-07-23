using System.Reflection;
using AppointVaAPI.Models;
using AppointVaAPI.Services;
using AppointVaAPI.Constants;
using FluentAssertions;

namespace AppointVaAPI.Tests.Services;

/// <summary>
/// Tests for the 9 private static Plantilla* methods in EmailService.
/// Accessed via reflection since they are private — no network calls involved.
/// </summary>
public class EmailTemplatesTests
{
    // ─── helpers ────────────────────────────────────────────────────────────

    private static string Invoke(string methodName, params object?[] args)
    {
        var method = typeof(EmailService).GetMethod(
            methodName, BindingFlags.NonPublic | BindingFlags.Static)
            ?? throw new InvalidOperationException($"Method '{methodName}' not found on EmailService");

        return (string)method.Invoke(null, args)!;
    }

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
        var html = Invoke("PlantillaConfirmacion", cita, "Carlos", null, null, null, null, false);

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
        var html = Invoke("PlantillaConfirmacion", cita, "Carlos", null, null, null, null, true);

        html.Should().Contain("⏳");
        html.Should().Contain("Solicitud de cita recibida");
        html.Should().Contain("#f59e0b");
        html.Should().NotContain("Ver mi cita →");
    }

    [Fact]
    public void PlantillaConfirmacion_ConUrlCita_ContainsVerMiCita()
    {
        var cita = BuildCita();
        var html = Invoke("PlantillaConfirmacion", cita, "Carlos", "https://appointva.com/cita/1", null, null, null, false);

        html.Should().Contain("Ver mi cita →");
        html.Should().Contain("https://appointva.com/cita/1");
    }

    [Fact]
    public void PlantillaConfirmacion_ConEmpleado_ContainsEmpleadoName()
    {
        var cita = BuildCita(empleadoNombre: "Ana López");
        var html = Invoke("PlantillaConfirmacion", cita, "Carlos", null, null, null, null, false);

        html.Should().Contain("Atendido por");
        html.Should().Contain("Ana López");
    }

    [Fact]
    public void PlantillaConfirmacion_SinEmpleado_OmitsAtendidoPor()
    {
        var cita = BuildCita(empleadoNombre: null);
        var html = Invoke("PlantillaConfirmacion", cita, "Carlos", null, null, null, null, false);

        html.Should().NotContain("Atendido por");
    }

    [Fact]
    public void PlantillaConfirmacion_ConCalendario_ContainsCalendarLinks()
    {
        var cita = BuildCita();
        var html = Invoke("PlantillaConfirmacion", cita, "Carlos",
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
        var html = Invoke("PlantillaConfirmacion", cita, "Carlos",
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
        var html = Invoke("PlantillaConfirmacion", cita, "Carlos",
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
        var html = Invoke("PlantillaCancelacion", cita, "Lucía");

        html.Should().Contain("❌");
        html.Should().Contain("Tu cita fue cancelada");
        html.Should().Contain("#ef4444");
        html.Should().Contain("Manicure");
    }

    [Fact]
    public void PlantillaCancelacion_ConMotivo_ContainsMotivoBlock()
    {
        var cita = BuildCita(motivoCancelacion: "El negocio cerró ese día");
        var html = Invoke("PlantillaCancelacion", cita, "Lucía");

        html.Should().Contain("Motivo de cancelación");
        html.Should().Contain("El negocio cerró ese día");
    }

    [Fact]
    public void PlantillaCancelacion_SinMotivo_OmitsMotivoBlock()
    {
        var cita = BuildCita(motivoCancelacion: null);
        var html = Invoke("PlantillaCancelacion", cita, "Lucía");

        html.Should().NotContain("Motivo de cancelación");
    }

    // ─── PlantillaRecordatorio ───────────────────────────────────────────────

    [Fact]
    public void PlantillaRecordatorio_ContainsExpectedContent()
    {
        var cita = BuildCita(codigo: "XYZ789");
        var html = Invoke("PlantillaRecordatorio", cita, "Pedro", null, null);

        html.Should().Contain("⏰");
        html.Should().Contain("Recordatorio de cita");
        html.Should().Contain("#f59e0b");
        html.Should().Contain("Corte de cabello");
        html.Should().Contain("XYZ789");
    }

    [Fact]
    public void PlantillaRecordatorio_ConGoogleCal_ContainsCalendarLink()
    {
        var cita = BuildCita();
        var html = Invoke("PlantillaRecordatorio", cita, "Pedro", null, "https://cal.example.com/google");

        html.Should().Contain("Google Calendar");
    }

    // ─── PlantillaReagendar ──────────────────────────────────────────────────

    [Fact]
    public void PlantillaReagendar_ContainsExpectedContent()
    {
        var cita = BuildCita(codigo: "RRR999");
        var fechaOriginal = new DateTime(2026, 8, 5, 9, 0, 0, DateTimeKind.Utc);
        var html = Invoke("PlantillaReagendar", cita, "Marta", fechaOriginal);

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
        var html = Invoke("PlantillaSolicitudResena", cita, "Valentina", "https://appointva.com/resena/abc");

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
        var html = Invoke("PlantillaListaEspera",
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
        var html = Invoke("PlantillaRecuperacion", "Sofía", url);

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
        var html = Invoke("PlantillaVerificacion", "Diego", url);

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
        var html = Invoke("PlantillaBienvenida", "Jorge", "Barbería Classic", urlRes, urlDash);

        html.Should().Contain("🎉");
        html.Should().Contain("¡Bienvenido a AppointVa");
        html.Should().Contain("#c8a961");
    }

    [Fact]
    public void PlantillaBienvenida_ContainsThreeSteps()
    {
        var html = Invoke("PlantillaBienvenida", "Jorge", "Barbería Classic",
            "https://appointva.com/b/mi-negocio", "https://appointva.com/dashboard");

        // The numbered step boxes render ">1<", ">2<", ">3<" inside a div
        html.Should().Contain(">1<");
        html.Should().Contain(">2<");
        html.Should().Contain(">3<");
    }

    [Fact]
    public void PlantillaBienvenida_ContainsTipEmojis()
    {
        var html = Invoke("PlantillaBienvenida", "Jorge", "Barbería Classic",
            "https://appointva.com/b/mi-negocio", "https://appointva.com/dashboard");

        html.Should().Contain("📸");
        html.Should().Contain("💬");
        html.Should().Contain("⏰");
    }

    [Fact]
    public void PlantillaBienvenida_ContainsDashboardLinkAndSupportEmail()
    {
        var urlDash = "https://appointva.com/dashboard";
        var html = Invoke("PlantillaBienvenida", "Jorge", "Barbería Classic",
            "https://appointva.com/b/mi-negocio", urlDash);

        html.Should().Contain("Ir a mi panel →");
        html.Should().Contain(urlDash);
        html.Should().Contain("hola@appointva.com");
    }
}
