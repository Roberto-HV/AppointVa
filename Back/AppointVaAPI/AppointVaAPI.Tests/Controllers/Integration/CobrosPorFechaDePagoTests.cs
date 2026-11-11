using System.Net;
using System.Net.Http.Json;
using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Citas;
using AppointVaAPI.Models.Dtos.Pagos;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>
/// "El dinero cuenta el día que lo cobras": las superficies de caja (Cobro,
/// Historial y Cierre de caja) agrupan por la fecha del pago, no por la fecha
/// del servicio. La agenda (Por cobrar, Citas pagadas x/y) sigue contando por
/// la fecha de la cita, y el día de caja es el día natural del negocio, no el
/// día UTC.
/// </summary>
public class CobrosPorFechaDePagoTests : IntegrationTestBase
{
    public CobrosPorFechaDePagoTests(CustomWebApplicationFactory factory) : base(factory) { }

    private const string ZonaUtc    = "UTC";
    private const string ZonaMexico = "Central Standard Time (Mexico)"; // UTC-6 todo el año
    // Zona que sí observa horario de verano, para probar el salto de primavera.
    // Se nombra con el id de Windows porque es el que existe en cualquier host;
    // ZonaHorariaHelper.Resolver acepta igual el id IANA (America/Chicago).
    private const string ZonaCentralEeuu = "Central Standard Time";

    private static readonly DateTime Ayer   = new(2026, 3,  9, 0, 0, 0, DateTimeKind.Unspecified);
    private static readonly DateTime Hoy    = new(2026, 3, 10, 0, 0, 0, DateTimeKind.Unspecified);
    private static readonly DateTime Manana = new(2026, 3, 11, 0, 0, 0, DateTimeKind.Unspecified);

    /// <summary>8 de marzo de 2026: el reloj adelanta a las 02:00 locales y el día dura 23 horas.</summary>
    private static readonly DateTime DiaDelSalto        = new(2026, 3, 8, 0, 0, 0, DateTimeKind.Unspecified);
    private static readonly DateTime DiaDespuesDelSalto = new(2026, 3, 9, 0, 0, 0, DateTimeKind.Unspecified);

    /// <param name="InicioEn">Hora local del negocio, como se guarda la cita.</param>
    /// <param name="FechaPago">Instante UTC del cobro; null reproduce las filas previas a la columna.</param>
    /// <param name="EmpleadoSecundario">true ancla la cita al segundo empleado del negocio.</param>
    private sealed record CitaSemilla(
        DateTime InicioEn,
        DateTime? FechaPago,
        decimal Precio,
        bool Pagada = true,
        byte Estado = EstadosCitas.Completada,
        Guid? RegistradoPorId = null,
        bool EmpleadoSecundario = false);

    /// <summary>
    /// Ids del negocio sembrado. Los dos empleados quedan ligados a un usuario para
    /// poder pedir el resumen con un token de Empleado, no solo con el del propietario.
    /// </summary>
    private sealed record Semillero(
        Guid NegocioId,
        List<Guid> CitaIds,
        Guid EmpleadoId,
        Guid EmpleadoUsuarioId,
        Guid EmpleadoSecundarioId,
        Guid EmpleadoSecundarioUsuarioId);

    private async Task<Guid> SeedAsync(string zonaHoraria, params CitaSemilla[] citas) =>
        (await SeedConIdsAsync(zonaHoraria, citas)).NegocioId;

    private async Task<Semillero> SeedConIdsAsync(
        string zonaHoraria, params CitaSemilla[] citas)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var ahora = DateTime.UtcNow;

        var negocio = new Negocio
        {
            Id                 = Guid.NewGuid(),
            Nombre             = "Test Cobros Por Fecha De Pago",
            Slug               = $"test-cobros-pago-{Guid.NewGuid().ToString("N")[..8]}",
            ZonaHoraria        = zonaHoraria,
            Activo             = 1,
            FechaCreacion      = ahora,
            FechaActualizacion = ahora,
        };
        db.Negocios.Add(negocio);

        var servicio = new Servicio
        {
            Id                 = Guid.NewGuid(),
            NegocioId          = negocio.Id,
            Nombre             = "Corte",
            DuracionMinutos    = 30,
            BufferMinutos      = 0,
            Precio             = 100m,
            Orden              = 1,
            Activo             = 1,
            FechaCreacion      = ahora,
            FechaActualizacion = ahora,
        };
        db.Servicios.Add(servicio);

        var empleado = new Empleado
        {
            Id                 = Guid.NewGuid(),
            NegocioId          = negocio.Id,
            UsuarioId          = Guid.NewGuid(),
            Nombre             = "Empleado Test",
            Activo             = 1,
            FechaCreacion      = ahora,
            FechaActualizacion = ahora,
        };
        db.Empleados.Add(empleado);

        var empleadoSecundario = new Empleado
        {
            Id                 = Guid.NewGuid(),
            NegocioId          = negocio.Id,
            UsuarioId          = Guid.NewGuid(),
            Nombre             = "Empleado Test 2",
            Activo             = 1,
            FechaCreacion      = ahora,
            FechaActualizacion = ahora,
        };
        db.Empleados.Add(empleadoSecundario);

        var citaIds = new List<Guid>();
        var n = 0;
        foreach (var c in citas)
        {
            var cliente = new Cliente
            {
                Id                    = Guid.NewGuid(),
                NegocioId             = negocio.Id,
                NombreCompleto        = $"Cliente {n:D2}",
                Telefono              = $"55{n:D8}",
                TotalCitas            = 1,
                CantidadInasistencias = 0,
                FechaCreacion         = ahora,
                FechaActualizacion    = ahora,
            };
            db.Clientes.Add(cliente);

            var citaId = Guid.NewGuid();
            citaIds.Add(citaId);
            db.Citas.Add(new Cita
            {
                Id                 = citaId,
                NegocioId          = negocio.Id,
                ServicioId         = servicio.Id,
                EmpleadoId         = c.EmpleadoSecundario ? empleadoSecundario.Id : empleado.Id,
                ClienteId          = cliente.Id,
                InicioEn           = c.InicioEn,
                FinEn              = c.InicioEn.AddMinutes(30),
                Estado             = c.Estado,
                Precio             = c.Precio,
                Pagada             = c.Pagada,
                MetodoPago         = c.Pagada ? MetodosPago.Efectivo : null,
                MontoCobrado       = c.Pagada ? c.Precio : null,
                FechaPago          = c.FechaPago,
                RegistradoPorId    = c.RegistradoPorId,
                CodigoConfirmacion = Guid.NewGuid().ToString("N")[..8].ToUpper(),
                FechaCreacion      = ahora,
                FechaActualizacion = ahora,
            });
            n++;
        }

        await db.SaveChangesAsync();
        return new Semillero(
            negocio.Id,
            citaIds,
            empleado.Id,
            empleado.UsuarioId!.Value,
            empleadoSecundario.Id,
            empleadoSecundario.UsuarioId!.Value);
    }

    private HttpClient ClienteDe(Guid negocioId) => NewClient(TestTokenHelper.Propietario(negocioId));

    private HttpClient ClienteEmpleado(Guid negocioId, Guid usuarioId) =>
        NewClient(TestTokenHelper.GenerarToken("Empleado", negocioId, usuarioId));

    /// <summary>RegistradoPorId no viaja en CitaDto, así que se lee de la base.</summary>
    private async Task<Guid?> RegistradoPorIdAsync(Guid citaId)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return (await db.Citas.FindAsync(citaId))!.RegistradoPorId;
    }

    /// <summary>Rango del panel: desde va en seco y hasta lleva el fin de día (ver conFinDeDia en el front).</summary>
    private static string RangoDelDia(DateTime dia) =>
        $"desde={dia:yyyy-MM-dd}&hasta={dia:yyyy-MM-dd}T23:59:59";

    private async Task<ResumenCobrosDto> ResumenAsync(HttpClient client, DateTime dia, Guid? empleadoId = null)
    {
        var filtro = empleadoId.HasValue ? $"&empleadoId={empleadoId.Value}" : string.Empty;
        var response = await client.GetAsync($"/api/citas/resumen-cobros?{RangoDelDia(dia)}{filtro}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<ResumenCobrosDto>())!;
    }

    private async Task<CierreCajaDto> CierreAsync(HttpClient client, DateTime dia)
    {
        var response = await client.GetAsync($"api/cierre-caja?fecha={dia:yyyy-MM-dd}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<CierreCajaDto>())!;
    }

    [Fact]
    public async Task Cobro_PagoDeHoyPorCitaDeManana_CuentaHoyYNoManana()
    {
        // Se cobra por adelantado: el dinero ya está en la caja de hoy.
        var negocioId = await SeedAsync(ZonaUtc,
            new CitaSemilla(Manana.AddHours(10), FechaPago: Hoy.AddHours(18), Precio: 500m));
        var client = ClienteDe(negocioId);

        var resumenHoy = await ResumenAsync(client, Hoy);
        resumenHoy.TotalCobrado.Should().Be(500m, "el cobro ocurrió hoy");
        resumenHoy.Desglose.Single(d => d.Metodo == MetodosPago.Efectivo).Monto.Should().Be(500m);

        var resumenManana = await ResumenAsync(client, Manana);
        resumenManana.TotalCobrado.Should().Be(0m, "mañana solo se presta el servicio, no entra dinero");

        (await CierreAsync(client, Hoy)).EfectivoCobrado.Should().Be(500m);
        (await CierreAsync(client, Manana)).EfectivoCobrado.Should().Be(0m);
    }

    [Fact]
    public async Task Cobro_PagoDeAyerPorCitaDeHoy_NoInflaElTotalDeHoy()
    {
        var negocioId = await SeedAsync(ZonaUtc,
            new CitaSemilla(Hoy.AddHours(10), FechaPago: Ayer.AddHours(16), Precio: 400m));
        var client = ClienteDe(negocioId);

        (await ResumenAsync(client, Hoy)).TotalCobrado
            .Should().Be(0m, "ese dinero entró ayer");
        (await ResumenAsync(client, Ayer)).TotalCobrado
            .Should().Be(400m);

        (await CierreAsync(client, Hoy)).EfectivoCobrado.Should().Be(0m);
        (await CierreAsync(client, Ayer)).EfectivoCobrado.Should().Be(400m);
    }

    [Fact]
    public async Task Cobro_PorCobrarYCitasPagadas_SiguenContandoPorFechaDeLaCita()
    {
        // La regresión que causaría cambiar todo a FechaPago: una cita sin pagar
        // no tiene FechaPago, así que "Por cobrar" quedaría en cero para siempre.
        var negocioId = await SeedAsync(ZonaUtc,
            new CitaSemilla(Hoy.AddHours(9),  FechaPago: null, Precio: 300m, Pagada: false),
            new CitaSemilla(Hoy.AddHours(11), FechaPago: Ayer.AddHours(16), Precio: 400m));
        var client = ClienteDe(negocioId);

        var resumen = await ResumenAsync(client, Hoy);

        resumen.TotalPendiente.Should().Be(300m, "la cita sin pagar de hoy sigue en Por cobrar");
        resumen.TotalCitas.Should().Be(2, "las dos citas están agendadas hoy");
        resumen.CitasPagadas.Should().Be(1, "x/y se cuenta sobre la agenda del día");
        resumen.TotalCobrado.Should().Be(0m, "el único cobro ocurrió ayer");
    }

    [Fact]
    public async Task CierreCaja_CobroDeLaNocheEnZonaUtcMenos6_CuentaEnSuPropioDia()
    {
        // 20:00 del 10 de marzo en UTC-6 son las 02:00 UTC del 11. Comparando el
        // UTC crudo contra medianoche UTC, el cobro se iba al corte del día siguiente.
        var negocioId = await SeedAsync(ZonaMexico,
            new CitaSemilla(
                Hoy.AddHours(20),
                FechaPago: new DateTime(2026, 3, 11, 2, 0, 0, DateTimeKind.Utc),
                Precio: 600m));
        var client = ClienteDe(negocioId);

        (await CierreAsync(client, Hoy)).EfectivoCobrado
            .Should().Be(600m, "se cobró a las 20:00 hora del negocio, es del corte de ese día");
        (await CierreAsync(client, Manana)).EfectivoCobrado
            .Should().Be(0m, "el corte del día siguiente no hereda el cobro de la noche anterior");

        (await ResumenAsync(client, Hoy)).TotalCobrado.Should().Be(600m);
    }

    [Fact]
    public async Task HistorialPagos_CobroDeLaNocheEnZonaUtcMenos6_ApareceEnSuPropioDia()
    {
        var negocioId = await SeedAsync(ZonaMexico,
            new CitaSemilla(
                Hoy.AddHours(20),
                FechaPago: new DateTime(2026, 3, 11, 2, 0, 0, DateTimeKind.Utc),
                Precio: 600m));
        var client = ClienteDe(negocioId);

        var delDia = await client.GetFromJsonAsync<List<CitaDto>>(
            $"/api/citas/historial-pagos?desde={Hoy:yyyy-MM-dd}&hasta={Hoy:yyyy-MM-dd}");
        delDia!.Should().ContainSingle("el Historial tiene que cuadrar con el total de Cobro");

        var delDiaSiguiente = await client.GetFromJsonAsync<List<CitaDto>>(
            $"/api/citas/historial-pagos?desde={Manana:yyyy-MM-dd}&hasta={Manana:yyyy-MM-dd}");
        delDiaSiguiente!.Should().BeEmpty();
    }

    [Fact]
    public async Task Cobro_FilaAntiguaSinFechaPago_SigueSumandoEnSuDiaDeCita()
    {
        // Program.cs agregó FechaPago como NULL sin rellenar el histórico: ese
        // dinero no puede desaparecer de los totales ni del corte.
        var negocioId = await SeedAsync(ZonaUtc,
            new CitaSemilla(Hoy.AddHours(10), FechaPago: null, Precio: 250m));
        var client = ClienteDe(negocioId);

        var resumen = await ResumenAsync(client, Hoy);
        resumen.TotalCobrado.Should().Be(250m);
        resumen.Desglose.Single(d => d.Metodo == MetodosPago.Efectivo).Monto.Should().Be(250m);
        resumen.Desglose.Single(d => d.Metodo == MetodosPago.Efectivo).Cantidad.Should().Be(1);

        (await CierreAsync(client, Hoy)).EfectivoCobrado
            .Should().Be(250m, "antes se exigía FechaPago y el corte perdía el efectivo");
        (await CierreAsync(client, Manana)).EfectivoCobrado.Should().Be(0m);
    }

    [Fact]
    public async Task Cobro_PagoEnElUltimoSegundoDelDia_CuentaEseDiaYNoElSiguiente()
    {
        // El front manda hasta=...T23:59:59 y FechaPago guarda milisegundos: un
        // cobro a las 23:59:59.400 quedaba fuera de los dos días y el dinero se
        // perdía del total aunque el Corte sí lo mostrara.
        var negocioId = await SeedAsync(ZonaUtc,
            new CitaSemilla(
                Hoy.AddHours(20),
                FechaPago: new DateTime(2026, 3, 10, 23, 59, 59, 400, DateTimeKind.Utc),
                Precio: 700m));
        var client = ClienteDe(negocioId);

        var resumenHoy = await ResumenAsync(client, Hoy);
        resumenHoy.TotalCobrado.Should().Be(700m, "el cobro ocurrió antes de medianoche");
        resumenHoy.Desglose.Single(d => d.Metodo == MetodosPago.Efectivo).Monto.Should().Be(700m);
        resumenHoy.Desglose.Single(d => d.Metodo == MetodosPago.Efectivo).Cantidad.Should().Be(1);

        (await ResumenAsync(client, Manana)).TotalCobrado
            .Should().Be(0m, "el día siguiente no hereda el cobro del último segundo");

        (await CierreAsync(client, Hoy)).EfectivoCobrado
            .Should().Be(700m, "el Corte y el total de Cobro tienen que cuadrar");
    }

    [Fact]
    public async Task MarcarPago_CorregirUnaVentaYaPagada_NoLaMueveAlDiaDeHoy()
    {
        // El propietario corrige el método de pago de una venta de ayer: el
        // dinero tiene que seguir contando en el día en que se cobró, y el
        // crédito del registro tiene que seguir siendo de quien la cobró.
        var cobroLaEmpleada = Guid.NewGuid();
        var semillero = await SeedConIdsAsync(ZonaUtc,
            new CitaSemilla(Ayer.AddHours(10), FechaPago: Ayer.AddHours(16), Precio: 400m,
                            RegistradoPorId: cobroLaEmpleada));
        var client = ClienteDe(semillero.NegocioId);

        // El día de la corrección se lee una sola vez, antes del PATCH: volver a
        // mirar el reloj después haría que una corrida que cruza la medianoche UTC
        // consultara un día distinto al que vio el servidor. El aserto solo dice
        // algo si ese día no es el día ya sellado, así que se deja explícito.
        var diaDeLaCorreccion = DateTime.UtcNow.Date;
        diaDeLaCorreccion.Should().NotBe(Ayer.Date, "el escenario fija el cobro en un día del pasado");

        var response = await client.PatchAsJsonAsync($"api/citas/{semillero.CitaIds[0]}/pago", new MarcarPagoDto
        {
            Pagada       = true,
            MetodoPago   = MetodosPago.Tarjeta,
            MontoCobrado = 400m,
        });
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var cita = await response.Content.ReadFromJsonAsync<CitaDto>();
        cita!.FechaPago.Should().Be(Ayer.AddHours(16), "corregir una venta no vuelve a fecharla");
        cita.MetodoPago.Should().Be(MetodosPago.Tarjeta, "la corrección sí se guarda");

        (await RegistradoPorIdAsync(semillero.CitaIds[0])).Should().Be(cobroLaEmpleada,
            "corregir el cobro de una empleada no le pasa el crédito al propietario");

        (await ResumenAsync(client, Ayer)).TotalCobrado
            .Should().Be(400m, "el dinero sigue en el día en que entró a caja");
        (await ResumenAsync(client, diaDeLaCorreccion)).TotalCobrado
            .Should().Be(0m, "corregir hoy no puede inventar un cobro de hoy");
    }

    [Fact]
    public async Task MarcarPago_DespagarYVolverAPagar_SellaUnaFechaNueva()
    {
        // El candado solo evita re-fechar una corrección: si el pago se revierte
        // y se vuelve a cobrar, el dinero entra de nuevo y hoy es su día.
        var semillero = await SeedConIdsAsync(ZonaUtc,
            new CitaSemilla(Ayer.AddHours(10), FechaPago: Ayer.AddHours(16), Precio: 400m));
        var client = ClienteDe(semillero.NegocioId);
        var antesDelCobro = DateTime.UtcNow;

        (await client.PatchAsJsonAsync($"api/citas/{semillero.CitaIds[0]}/pago",
            new MarcarPagoDto { Pagada = false })).StatusCode.Should().Be(HttpStatusCode.OK);

        var response = await client.PatchAsJsonAsync($"api/citas/{semillero.CitaIds[0]}/pago", new MarcarPagoDto
        {
            Pagada       = true,
            MetodoPago   = MetodosPago.Efectivo,
            MontoCobrado = 400m,
        });
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var cita = await response.Content.ReadFromJsonAsync<CitaDto>();
        cita!.FechaPago.Should().NotBeNull();
        cita.FechaPago!.Value.Should().BeOnOrAfter(antesDelCobro, "es un cobro nuevo, no la venta de ayer");

        (await ResumenAsync(client, Ayer)).TotalCobrado
            .Should().Be(0m, "el cobro de ayer se revirtió");
        // El día se saca de la fecha que devolvió el PATCH, no de un segundo
        // DateTime.UtcNow: si la corrida cruza la medianoche UTC entre las dos
        // lecturas, la segunda consultaría un día distinto al que se selló.
        (await ResumenAsync(client, cita.FechaPago!.Value.Date)).TotalCobrado
            .Should().Be(400m, "el dinero entró el día en que se volvió a cobrar");
    }

    [Fact]
    public async Task Cobro_ConHastaEnFechaSeca_CuentaElDiaCompletoIgualQueConFinDeDia()
    {
        // El panel manda hasta=...T23:59:59, pero la firma del endpoint documenta la
        // fecha en seco. El servidor normaliza el corte a la medianoche local del día
        // siguiente, así que las dos formas tienen que devolver lo mismo; antes la
        // fecha en seco abría una ventana de un segundo y el total salía en cero.
        // La fila antigua sin FechaPago entra al mismo rango por su InicioEn: su rama
        // usa el mismo corte normalizado, no el "hasta" crudo.
        var negocioId = await SeedAsync(ZonaUtc,
            new CitaSemilla(Hoy.AddHours(10), FechaPago: Hoy.AddHours(18), Precio: 500m),
            new CitaSemilla(Hoy.AddHours(15), FechaPago: null, Precio: 250m));
        var client = ClienteDe(negocioId);

        var response = await client.GetAsync(
            $"/api/citas/resumen-cobros?desde={Hoy:yyyy-MM-dd}&hasta={Hoy:yyyy-MM-dd}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var resumen = (await response.Content.ReadFromJsonAsync<ResumenCobrosDto>())!;

        resumen.TotalCobrado.Should().Be(750m, "la fecha en seco cubre el día entero del negocio");
        resumen.Desglose.Single(d => d.Metodo == MetodosPago.Efectivo).Monto.Should().Be(750m);
        resumen.Desglose.Single(d => d.Metodo == MetodosPago.Efectivo).Cantidad
            .Should().Be(2, "la fila sin FechaPago también entra por su InicioEn de media tarde");

        (await ResumenAsync(client, Hoy)).TotalCobrado
            .Should().Be(750m, "y la forma con fin de día cae en el mismo instante");
        (await ResumenAsync(client, Manana)).TotalCobrado
            .Should().Be(0m, "el corte sigue siendo exclusivo: el día siguiente no hereda el cobro");
    }

    [Fact]
    public async Task Cobro_ConFiltroDeEmpleado_SoloSumaElDineroDeEseEmpleado()
    {
        // La consulta del dinero se separó de la de la agenda y volvió a aplicar el
        // filtro por empleado por su cuenta. Si esa línea se cayera, un empleado
        // vería la caja de todo el local sin que ninguna otra prueba se enterara.
        var semillero = await SeedConIdsAsync(ZonaUtc,
            new CitaSemilla(Hoy.AddHours(10), FechaPago: Hoy.AddHours(11), Precio: 500m),
            new CitaSemilla(Hoy.AddHours(12), FechaPago: Hoy.AddHours(13), Precio: 900m,
                            EmpleadoSecundario: true));

        var propietario = ClienteDe(semillero.NegocioId);
        (await ResumenAsync(propietario, Hoy)).TotalCobrado
            .Should().Be(1400m, "el propietario sí ve la caja completa del día");

        // Con token de Empleado el servidor resuelve UsuarioId → EmpleadoId.
        var resumenEmpleado = await ResumenAsync(
            ClienteEmpleado(semillero.NegocioId, semillero.EmpleadoUsuarioId), Hoy);

        resumenEmpleado.TotalCobrado
            .Should().Be(500m, "un empleado no puede ver lo que cobró el resto del local");
        resumenEmpleado.Desglose.Single(d => d.Metodo == MetodosPago.Efectivo).Monto
            .Should().Be(500m, "el desglose se recorta igual que el total");
        resumenEmpleado.Desglose.Single(d => d.Metodo == MetodosPago.Efectivo).Cantidad
            .Should().Be(1);

        // El mismo recorte por el parámetro explícito, que es como lo pide el panel.
        var resumenFiltrado = await ResumenAsync(propietario, Hoy, semillero.EmpleadoSecundarioId);
        resumenFiltrado.TotalCobrado.Should().Be(900m);
        resumenFiltrado.Desglose.Single(d => d.Metodo == MetodosPago.Efectivo).Monto.Should().Be(900m);

        // El rol pisa al parámetro: un empleado que pide empleadoId de otro sigue
        // viendo solo su propia caja. Es lo único que impide leer la del vecino.
        var resumenEmpleadoConFiltroAjeno = await ResumenAsync(
            ClienteEmpleado(semillero.NegocioId, semillero.EmpleadoUsuarioId),
            Hoy,
            semillero.EmpleadoSecundarioId);

        resumenEmpleadoConFiltroAjeno.TotalCobrado
            .Should().Be(500m, "empleadoId no puede abrir la caja de otro empleado");
        resumenEmpleadoConFiltroAjeno.Desglose.Single(d => d.Metodo == MetodosPago.Efectivo).Monto
            .Should().Be(500m, "el desglose se recorta igual que el total");
    }

    [Fact]
    public async Task Cobro_EnElDiaQueAdelantaElReloj_RespetaElDesfaseDeCadaFecha()
    {
        // Las demás pruebas usan zonas de desfase fijo, así que no distinguen el
        // desfase real de la fecha del desfase base de la zona. El 8 de marzo de 2026
        // el centro de EE. UU. pasa de UTC-6 a UTC-5 a las 02:00 locales: ese día dura
        // 23 horas y su medianoche de cierre cae una hora antes en UTC. Con un desfase
        // constante, el primer cobro del día siguiente se iría al corte del día del salto.
        var tz = AppointVaAPI.Helpers.ZonaHorariaHelper.Resolver(ZonaCentralEeuu);
        tz.GetUtcOffset(DiaDelSalto).Should().Be(TimeSpan.FromHours(-6),
            "si la zona no se resolvió, la prueba no demostraría nada");
        tz.GetUtcOffset(DiaDespuesDelSalto).Should().Be(TimeSpan.FromHours(-5),
            "el 8 de marzo de 2026 la zona adelanta el reloj");

        var negocioId = await SeedAsync(ZonaCentralEeuu,
            // 00:30 del día del salto, todavía en UTC-6.
            new CitaSemilla(
                DiaDelSalto.AddHours(9),
                FechaPago: new DateTime(2026, 3, 8, 6, 30, 0, DateTimeKind.Utc),
                Precio: 100m),
            // 23:30 del día del salto, ya en UTC-5.
            new CitaSemilla(
                DiaDelSalto.AddHours(20),
                FechaPago: new DateTime(2026, 3, 9, 4, 30, 0, DateTimeKind.Utc),
                Precio: 200m),
            // 00:30 del día siguiente, en UTC-5: con el desfase base caería en el día del salto.
            new CitaSemilla(
                DiaDespuesDelSalto.AddHours(9),
                FechaPago: new DateTime(2026, 3, 9, 5, 30, 0, DateTimeKind.Utc),
                Precio: 400m));
        var client = ClienteDe(negocioId);

        (await ResumenAsync(client, DiaDelSalto)).TotalCobrado
            .Should().Be(300m, "la primera y la última hora locales del día del salto son de ese día");
        (await ResumenAsync(client, DiaDespuesDelSalto)).TotalCobrado
            .Should().Be(400m, "la primera hora del día siguiente ya no pertenece al día del salto");

        (await CierreAsync(client, DiaDelSalto)).EfectivoCobrado
            .Should().Be(300m, "el corte tiene que cuadrar con el total de Cobro");
        (await CierreAsync(client, DiaDespuesDelSalto)).EfectivoCobrado
            .Should().Be(400m);
    }
}
