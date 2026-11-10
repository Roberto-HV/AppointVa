using System.Text.Json;
using AppointVaAPI.Constants;
using AppointVaAPI.Controllers.V1;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Publico;
using AppointVaAPI.Repository.IRepository;
using AppointVaAPI.Services.IServices;
using FluentAssertions;
using Hangfire;
using Hangfire.Common;
using Hangfire.States;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using NSubstitute;

namespace AppointVaAPI.Tests.Controllers;

/// <summary>
/// Propiedad de seguridad de los endpoints públicos sin autenticar: un número de teléfono
/// ajeno no debe bastar para obtener el correo, el nombre en archivo ni los códigos de
/// confirmación de otra persona — con eso se cancelan o mueven citas de un desconocido.
/// Los tests describen qué sale en la respuesta, no cómo se construye.
/// </summary>
public class PublicoDatosClienteExpuestosTests
{
    private const string Telefono = "5599887766";
    private const string EmailEnArchivo = "victima@correo.com";
    private const string NombreEnArchivo = "Elena López";

    // ── Armado ────────────────────────────────────────────────────────────────

    private static (PublicoController controller,
        INegocioRepository negocioRepo,
        ICitaRepository citaRepo,
        IClienteRepository clienteRepo,
        IBackgroundJobClient jobClient,
        ApplicationDbContext db)
        CrearComponentes(string dbNombre)
    {
        var db = DbContextFactory.Create(dbNombre);
        var negocioRepo = Substitute.For<INegocioRepository>();
        var citaRepo = Substitute.For<ICitaRepository>();
        var clienteRepo = Substitute.For<IClienteRepository>();
        var jobClient = Substitute.For<IBackgroundJobClient>();

        var controller = new PublicoController(
            db,
            negocioRepo,
            citaRepo,
            clienteRepo,
            Substitute.For<IDisponibilidadService>(),
            Substitute.For<INotificacionService>(),
            Substitute.For<IEmailService>(),
            Substitute.For<IConfiguration>(),
            jobClient,
            null!,                              // UserManager — sin uso en estos endpoints
            Substitute.For<IBlobStorageService>(),
            Substitute.For<IPushService>())
        {
            // "mis-citas" escribe X-Total-Count en la respuesta.
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };

        return (controller, negocioRepo, citaRepo, clienteRepo, jobClient, db);
    }

    private static Negocio NegocioActivo() => new()
    {
        Id = Guid.NewGuid(),
        Slug = "mi-salon",
        Nombre = "Mi Salón",
        Activo = 1,
        AutoConfirmar = true,
        HorasRecordatorio = 24,
        FechaCreacion = DateTime.UtcNow,
        FechaActualizacion = DateTime.UtcNow,
    };

    private static Cliente ClienteEnArchivo(Guid negocioId) => new()
    {
        Id = Guid.NewGuid(),
        NegocioId = negocioId,
        NombreCompleto = NombreEnArchivo,
        Telefono = Telefono,
        Email = EmailEnArchivo,
        TotalCitas = 1,
        CantidadInasistencias = 0,
        FechaCreacion = DateTime.UtcNow,
        FechaActualizacion = DateTime.UtcNow,
    };

    // Sin el codificador relajado, System.Text.Json escapa los acentos («López» →
    // «López») y una aserción sobre el texto crudo nunca encontraría el dato filtrado.
    // La política camelCase es la de ASP.NET Core: así las respuestas con DTO tipado se
    // inspeccionan con los mismos nombres que ve el cliente HTTP, igual que las anónimas.
    private static readonly JsonSerializerOptions SinEscaparAcentos = new()
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    /// <summary>Serializa la respuesta anónima para inspeccionarla como la ve el cliente HTTP.</summary>
    private static JsonElement ComoJson(object? valor) =>
        JsonSerializer.SerializeToElement(valor, valor!.GetType(), SinEscaparAcentos);

    // ── GET api/publico/cliente ───────────────────────────────────────────────

    [Fact]
    public async Task BusquedaPorTelefono_NoDevuelveNingunCorreo()
    {
        var (controller, _, _, _, _, db) = CrearComponentes(
            nameof(BusquedaPorTelefono_NoDevuelveNingunCorreo));
        var negocio = NegocioActivo();
        db.Negocios.Add(negocio);
        db.Clientes.Add(ClienteEnArchivo(negocio.Id));
        await db.SaveChangesAsync();

        var result = await controller.BuscarClienteDatos(negocio.Slug, email: null, telefono: Telefono);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var json = ComoJson(ok.Value);
        json.GetRawText().Should().NotContain(EmailEnArchivo,
            "un teléfono ajeno no debe entregar la dirección de correo de su dueño");
        json.GetProperty("tieneEmail").GetBoolean().Should().BeTrue(
            "la reserva sólo necesita saber que hay un correo al que mandar la confirmación");
        json.GetProperty("nombreCliente").GetString().Should().Be(NombreEnArchivo);
    }

    [Fact]
    public async Task BusquedaPorTelefono_DiceQueNoHayCorreo_CuandoElClienteNoTieneUno()
    {
        var (controller, _, _, _, _, db) = CrearComponentes(
            nameof(BusquedaPorTelefono_DiceQueNoHayCorreo_CuandoElClienteNoTieneUno));
        var negocio = NegocioActivo();
        var cliente = ClienteEnArchivo(negocio.Id);
        cliente.Email = null;
        db.Negocios.Add(negocio);
        db.Clientes.Add(cliente);
        await db.SaveChangesAsync();

        var result = await controller.BuscarClienteDatos(negocio.Slug, email: null, telefono: Telefono);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ComoJson(ok.Value).GetProperty("tieneEmail").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task BusquedaPorCorreo_DevuelveElCorreoQueYaTraia()
    {
        var (controller, _, _, _, _, db) = CrearComponentes(
            nameof(BusquedaPorCorreo_DevuelveElCorreoQueYaTraia));
        var negocio = NegocioActivo();
        db.Negocios.Add(negocio);
        db.Clientes.Add(ClienteEnArchivo(negocio.Id));
        await db.SaveChangesAsync();

        var result = await controller.BuscarClienteDatos(negocio.Slug, email: EmailEnArchivo, telefono: null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ComoJson(ok.Value).GetProperty("emailCliente").GetString().Should().Be(EmailEnArchivo,
            "devolver la llave con la que se consultó no revela nada nuevo");
    }

    [Fact]
    public async Task BusquedaConCorreoEquivocadoYTelefonoAjeno_NoDevuelveElCorreoEnArchivo()
    {
        var (controller, _, _, _, _, db) = CrearComponentes(
            nameof(BusquedaConCorreoEquivocadoYTelefonoAjeno_NoDevuelveElCorreoEnArchivo));
        var negocio = NegocioActivo();
        db.Negocios.Add(negocio);
        db.Clientes.Add(ClienteEnArchivo(negocio.Id));
        await db.SaveChangesAsync();

        // El correo no acierta; el teléfono sí. El eco no puede volverse una filtración.
        var result = await controller.BuscarClienteDatos(
            negocio.Slug, email: "atacante@correo.com", telefono: Telefono);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ComoJson(ok.Value).GetRawText().Should().NotContain(EmailEnArchivo);
    }

    // ── GET api/publico/mis-citas ─────────────────────────────────────────────

    private static async Task<Cita> SembrarCitaAsync(ApplicationDbContext db, Negocio negocio, Cliente cliente)
    {
        var servicio = new Servicio
        {
            Id = Guid.NewGuid(), NegocioId = negocio.Id, Nombre = "Corte de Cabello",
            DuracionMinutos = 60, BufferMinutos = 0, Precio = 150m, Orden = 1, Activo = 1,
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        };
        var empleado = new Empleado
        {
            Id = Guid.NewGuid(), NegocioId = negocio.Id, Nombre = "Ana Estilista", Activo = 1,
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        };
        var cita = new Cita
        {
            Id = Guid.NewGuid(),
            NegocioId = negocio.Id,
            CodigoConfirmacion = "ABC123",
            ClienteId = cliente.Id,
            EmpleadoId = empleado.Id,
            ServicioId = servicio.Id,
            InicioEn = DateTime.UtcNow.AddDays(3),
            FinEn = DateTime.UtcNow.AddDays(3).AddHours(1),
            Estado = 2,
            Precio = 150m,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        };
        db.Servicios.Add(servicio);
        db.Empleados.Add(empleado);
        db.Citas.Add(cita);
        await db.SaveChangesAsync();
        return cita;
    }

    [Fact]
    public async Task MisCitas_PorTelefono_ListaLasCitasSinElCodigoDeConfirmacion()
    {
        var (controller, negocioRepo, _, _, _, db) = CrearComponentes(
            nameof(MisCitas_PorTelefono_ListaLasCitasSinElCodigoDeConfirmacion));
        var negocio = NegocioActivo();
        var cliente = ClienteEnArchivo(negocio.Id);
        db.Negocios.Add(negocio);
        db.Clientes.Add(cliente);
        await db.SaveChangesAsync();
        await SembrarCitaAsync(db, negocio, cliente);
        negocioRepo.ObtenerPorSlugAsync(negocio.Slug).Returns(negocio);

        var result = await controller.ObtenerMisCitas(negocio.Slug, email: null, telefono: Telefono);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var json = ComoJson(ok.Value);
        json.GetArrayLength().Should().Be(1, "la lista se sigue viendo con el teléfono");
        json[0].GetProperty("codigoConfirmacion").ValueKind.Should().Be(JsonValueKind.Null,
            "el código autoriza cancelar y reagendar: un teléfono ajeno no debe entregarlo");
        json.GetRawText().Should().NotContain("ABC123");
    }

    [Fact]
    public async Task MisCitas_PorCorreo_EntregaElCodigoQueNecesitaElReagendado()
    {
        var (controller, negocioRepo, _, _, _, db) = CrearComponentes(
            nameof(MisCitas_PorCorreo_EntregaElCodigoQueNecesitaElReagendado));
        var negocio = NegocioActivo();
        var cliente = ClienteEnArchivo(negocio.Id);
        db.Negocios.Add(negocio);
        db.Clientes.Add(cliente);
        await db.SaveChangesAsync();
        await SembrarCitaAsync(db, negocio, cliente);
        negocioRepo.ObtenerPorSlugAsync(negocio.Slug).Returns(negocio);

        var result = await controller.ObtenerMisCitas(negocio.Slug, email: EmailEnArchivo, telefono: null);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var json = ComoJson(ok.Value);
        json.GetArrayLength().Should().Be(1);
        json[0].GetProperty("codigoConfirmacion").GetString().Should().Be("ABC123",
            "quien ya trajo el correo tiene lo mismo que el código autoriza");
    }

    // ── POST api/publico/citas ────────────────────────────────────────────────

    [Fact]
    public async Task Conflicto409DeTelefonoAjeno_NoRevelaElNombreEnArchivo()
    {
        var (controller, negocioRepo, citaRepo, clienteRepo, _, db) = CrearComponentes(
            nameof(Conflicto409DeTelefonoAjeno_NoRevelaElNombreEnArchivo));
        var negocio = NegocioActivo();
        negocioRepo.ObtenerPorSlugAsync(negocio.Slug).Returns(negocio);
        var (servicio, empleado) = await SembrarCatalogoAsync(db, negocio);
        citaRepo.ExisteSolapamientoAsync(
            Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<Guid?>())
            .Returns(false);
        clienteRepo.ObtenerOCrearAsync(
            Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<bool>())
            .Returns(new ResolucionCliente(
                ResultadoResolucionCliente.ConflictoNombre, ClienteEnArchivo(negocio.Id)));

        var result = await controller.CrearCita(new CrearCitaPublicaDto
        {
            NegocioSlug = negocio.Slug,
            ServicioId = servicio.Id,
            EmpleadoId = empleado.Id,
            InicioEn = DateTime.UtcNow.AddDays(3),
            NombreCliente = "María Ramírez",
            TelefonoCliente = Telefono,
        });

        var conflict = result.Should().BeOfType<ConflictObjectResult>().Subject;
        var json = ComoJson(conflict.Value);
        json.GetRawText().Should().NotContain(NombreEnArchivo,
            "el 409 no puede ser un segundo oráculo de teléfono → nombre legal");
        json.TryGetProperty("nombreExistente", out _).Should().BeFalse();
        json.GetProperty("codigo").GetString().Should().Be(CodigosError.ClienteNombreDistinto,
            "el frontend sigue distinguiendo este 409 por su código, no por el mensaje");
        await citaRepo.DidNotReceive().CrearAsync(Arg.Any<Cita>());
    }

    [Fact]
    public async Task ReservaDeClienteConocidoSinCorreoEnElCuerpo_ConfirmaAlCorreoEnArchivo()
    {
        var (controller, negocioRepo, citaRepo, clienteRepo, jobClient, db) = CrearComponentes(
            nameof(ReservaDeClienteConocidoSinCorreoEnElCuerpo_ConfirmaAlCorreoEnArchivo));
        var negocio = NegocioActivo();
        negocioRepo.ObtenerPorSlugAsync(negocio.Slug).Returns(negocio);
        var (servicio, empleado) = await SembrarCatalogoAsync(db, negocio);
        citaRepo.ExisteSolapamientoAsync(
            Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<Guid?>())
            .Returns(false);
        clienteRepo.ObtenerOCrearAsync(
            Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<bool>())
            .Returns(new ResolucionCliente(
                ResultadoResolucionCliente.Encontrado, ClienteEnArchivo(negocio.Id)));

        var encolados = new List<Job>();
        jobClient.Create(Arg.Do<Job>(j => encolados.Add(j)), Arg.Any<IState>());

        // El cliente conocido ya no teclea su correo: la búsqueda por teléfono dejó de darlo.
        var result = await controller.CrearCita(new CrearCitaPublicaDto
        {
            NegocioSlug = negocio.Slug,
            ServicioId = servicio.Id,
            EmpleadoId = empleado.Id,
            InicioEn = DateTime.UtcNow.AddDays(3),
            NombreCliente = NombreEnArchivo,
            TelefonoCliente = Telefono,
            EmailCliente = null,
        });

        result.Should().BeOfType<CreatedAtActionResult>();
        var confirmacion = encolados.FirstOrDefault(j => j.Method.Name == "EnviarConfirmacionAsync");
        confirmacion.Should().NotBeNull(
            "un cliente que ya dejó su correo debe recibir la confirmación sin volver a teclearlo");
        confirmacion!.Args.Should().Contain(EmailEnArchivo);
    }

    // ── GET api/publico/citas/{codigo} ────────────────────────────────────────

    /// <summary>
    /// Una cita que el repositorio devuelve ya resuelta, como la consulta por código.
    /// </summary>
    private static Cita CitaConCliente(Negocio negocio, Cliente cliente) => new()
    {
        Id = Guid.NewGuid(),
        NegocioId = negocio.Id,
        CodigoConfirmacion = "ABC123",
        ClienteId = cliente.Id,
        EmpleadoId = Guid.NewGuid(),
        ServicioId = Guid.NewGuid(),
        InicioEn = DateTime.UtcNow.AddDays(3),
        FinEn = DateTime.UtcNow.AddDays(3).AddHours(1),
        Estado = EstadosCitas.Confirmada,
        Precio = 150m,
        FechaCreacion = DateTime.UtcNow,
        FechaActualizacion = DateTime.UtcNow,
        Negocio = negocio,
        Cliente = cliente,
    };

    [Fact]
    public async Task ConsultaPorCodigo_NoDevuelveElCorreoEnArchivo_PeroDiceQueExiste()
    {
        var (controller, _, citaRepo, _, _, _) = CrearComponentes(
            nameof(ConsultaPorCodigo_NoDevuelveElCorreoEnArchivo_PeroDiceQueExiste));
        var negocio = NegocioActivo();
        var cita = CitaConCliente(negocio, ClienteEnArchivo(negocio.Id));
        citaRepo.ObtenerPorCodigoAsync(cita.CodigoConfirmacion).Returns(cita);

        var result = await controller.ObtenerCita(cita.CodigoConfirmacion);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var json = ComoJson(ok.Value);
        json.GetProperty("emailCliente").ValueKind.Should().Be(JsonValueKind.Null,
            "el correo en archivo es lo que autoriza cancelar y reagendar: entregarlo a " +
            "cambio del código sería dar la credencial de la propia autorización");
        json.GetRawText().Should().NotContain(EmailEnArchivo);
        json.GetProperty("tieneEmail").GetBoolean().Should().BeTrue(
            "la página sólo necesita saber que hay un correo al que salió la confirmación");
    }

    [Fact]
    public async Task ConsultaPorCodigo_DiceQueNoHayCorreo_CuandoElClienteNoTieneUno()
    {
        var (controller, _, citaRepo, _, _, _) = CrearComponentes(
            nameof(ConsultaPorCodigo_DiceQueNoHayCorreo_CuandoElClienteNoTieneUno));
        var negocio = NegocioActivo();
        var cliente = ClienteEnArchivo(negocio.Id);
        cliente.Email = null;
        var cita = CitaConCliente(negocio, cliente);
        citaRepo.ObtenerPorCodigoAsync(cita.CodigoConfirmacion).Returns(cita);

        var result = await controller.ObtenerCita(cita.CodigoConfirmacion);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var json = ComoJson(ok.Value);
        json.GetProperty("tieneEmail").GetBoolean().Should().BeFalse(
            "sin correo en archivo no hay autogestión posible y la página lo avisa");
        json.GetProperty("emailCliente").ValueKind.Should().Be(JsonValueKind.Null);
    }

    [Fact]
    public async Task Reserva_DevuelveElCorreoQueTecleoQuienReserva()
    {
        var (controller, negocioRepo, citaRepo, clienteRepo, _, db) = CrearComponentes(
            nameof(Reserva_DevuelveElCorreoQueTecleoQuienReserva));
        var negocio = NegocioActivo();
        negocioRepo.ObtenerPorSlugAsync(negocio.Slug).Returns(negocio);
        var (servicio, empleado) = await SembrarCatalogoAsync(db, negocio);
        citaRepo.ExisteSolapamientoAsync(
            Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<Guid?>())
            .Returns(false);
        clienteRepo.ObtenerOCrearAsync(
            Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<bool>())
            .Returns(new ResolucionCliente(
                ResultadoResolucionCliente.Creado, ClienteEnArchivo(negocio.Id)));

        var result = await controller.CrearCita(new CrearCitaPublicaDto
        {
            NegocioSlug = negocio.Slug,
            ServicioId = servicio.Id,
            EmpleadoId = empleado.Id,
            InicioEn = DateTime.UtcNow.AddDays(3),
            NombreCliente = NombreEnArchivo,
            TelefonoCliente = Telefono,
            EmailCliente = EmailEnArchivo,
        });

        var creado = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        var json = ComoJson(creado.Value);
        json.GetProperty("emailCliente").GetString().Should().Be(EmailEnArchivo,
            "devolver el correo que se acaba de teclear no revela nada, y es lo que deja " +
            "cancelar o reagendar sin volver a pedirlo");
        json.GetProperty("tieneEmail").GetBoolean().Should().BeTrue();
    }

    private static async Task<(Servicio servicio, Empleado empleado)> SembrarCatalogoAsync(
        ApplicationDbContext db, Negocio negocio)
    {
        db.Negocios.Add(negocio);
        var servicio = new Servicio
        {
            Id = Guid.NewGuid(), NegocioId = negocio.Id, Nombre = "Corte de Cabello",
            DuracionMinutos = 60, BufferMinutos = 0, Precio = 150m, Orden = 1, Activo = 1,
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        };
        var empleado = new Empleado
        {
            Id = Guid.NewGuid(), NegocioId = negocio.Id, Nombre = "Ana Estilista", Activo = 1,
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        };
        db.Servicios.Add(servicio);
        db.Empleados.Add(empleado);
        db.EmpleadosServicios.Add(new EmpleadoServicio
        {
            EmpleadoId = empleado.Id,
            ServicioId = servicio.Id,
        });
        await db.SaveChangesAsync();
        return (servicio, empleado);
    }
}
