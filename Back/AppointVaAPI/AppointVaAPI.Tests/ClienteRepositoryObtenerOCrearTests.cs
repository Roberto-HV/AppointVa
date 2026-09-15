using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Repository;
using AppointVaAPI.Repository.IRepository;
using AppointVaAPI.Tests.Controllers;
using FluentAssertions;

namespace AppointVaAPI.Tests;

/// <summary>
/// Tests de ClienteRepository.ObtenerOCrearAsync: resolución del cliente por teléfono,
/// normalización del teléfono y detección de conflicto de nombre.
/// </summary>
public class ClienteRepositoryObtenerOCrearTests
{
    // ── Infraestructura ───────────────────────────────────────────────────────

    private static ApplicationDbContext CreateDb() =>
        DbContextFactory.Create(Guid.NewGuid().ToString());

    private static ClienteRepository CreateRepo(ApplicationDbContext db) => new(db);

    private static async Task<Cliente> SeedClienteAsync(
        ApplicationDbContext db, Guid negocioId, string nombre, string? telefono, string? email = null)
    {
        var cliente = new Cliente
        {
            Id = Guid.NewGuid(),
            NegocioId = negocioId,
            NombreCompleto = nombre,
            Telefono = telefono,
            Email = email,
            TotalCitas = 0,
            CantidadInasistencias = 0,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        };
        db.Clientes.Add(cliente);
        await db.SaveChangesAsync();
        return cliente;
    }

    // ── Resolución por teléfono ───────────────────────────────────────────────

    [Fact]
    public async Task Crea_CuandoNingunClienteTieneEseTelefono()
    {
        var db = CreateDb();
        var repo = CreateRepo(db);
        var negocioId = Guid.NewGuid();

        var resolucion = await repo.ObtenerOCrearAsync(negocioId, "María Ramírez", "5512345678", null);

        resolucion.Resultado.Should().Be(ResultadoResolucionCliente.Creado);
        resolucion.Cliente.NombreCompleto.Should().Be("María Ramírez");
        db.Clientes.Should().HaveCount(1);
    }

    [Fact]
    public async Task Reutiliza_CuandoTelefonoYNombreCoinciden()
    {
        var db = CreateDb();
        var repo = CreateRepo(db);
        var negocioId = Guid.NewGuid();
        var existente = await SeedClienteAsync(db, negocioId, "Elena López", "5512345678");

        var resolucion = await repo.ObtenerOCrearAsync(negocioId, "Elena López", "5512345678", null);

        resolucion.Resultado.Should().Be(ResultadoResolucionCliente.Encontrado);
        resolucion.Cliente.Id.Should().Be(existente.Id);
        db.Clientes.Should().HaveCount(1, "no debe crearse un segundo cliente con el mismo teléfono");
    }

    [Fact]
    public async Task NoConfundeClientesDeOtroNegocio()
    {
        var db = CreateDb();
        var repo = CreateRepo(db);
        var negocioA = Guid.NewGuid();
        var negocioB = Guid.NewGuid();
        await SeedClienteAsync(db, negocioA, "Elena López", "5512345678");

        var resolucion = await repo.ObtenerOCrearAsync(negocioB, "María Ramírez", "5512345678", null);

        resolucion.Resultado.Should().Be(ResultadoResolucionCliente.Creado,
            "el teléfono sólo identifica al cliente dentro de su propio negocio");
    }

    // ── Normalización del teléfono ────────────────────────────────────────────

    [Fact]
    public async Task GuardaTelefonoSoloDigitos_AlCrear()
    {
        var db = CreateDb();
        var repo = CreateRepo(db);
        var negocioId = Guid.NewGuid();

        var resolucion = await repo.ObtenerOCrearAsync(negocioId, "María Ramírez", "(55) 1234-5678", null);

        resolucion.Cliente.Telefono.Should().Be("5512345678",
            "los datos convergen a sólo-dígitos sin necesidad de migración");
    }

    [Theory]
    [InlineData("55 1234 5678")]
    [InlineData("(55) 1234-5678")]
    [InlineData("5512345678")]
    public async Task Reutiliza_CuandoTelefonoEnviadoConFormato_YFilaGuardadaEnDigitos(string telefonoEnviado)
    {
        var db = CreateDb();
        var repo = CreateRepo(db);
        var negocioId = Guid.NewGuid();
        var existente = await SeedClienteAsync(db, negocioId, "Elena López", "5512345678");

        var resolucion = await repo.ObtenerOCrearAsync(negocioId, "Elena López", telefonoEnviado, null);

        resolucion.Resultado.Should().Be(ResultadoResolucionCliente.Encontrado);
        resolucion.Cliente.Id.Should().Be(existente.Id);
    }

    /// <summary>
    /// Limitación conocida y deliberada: la búsqueda usa sólo predicados de igualdad
    /// (valor enviado tal cual y su forma sólo-dígitos) para que el índice único
    /// (NegocioId, Telefono) la siga sirviendo. Una fila antigua con formato
    /// arbitrario no se alcanza si se envían sólo dígitos, porque ese formato
    /// no se puede reconstruir sin normalizar la columna y perder el índice.
    /// </summary>
    [Fact]
    public async Task Crea_CuandoFilaAntiguaTieneEspacios_YSeEnviaSoloDigitos()
    {
        var db = CreateDb();
        var repo = CreateRepo(db);
        var negocioId = Guid.NewGuid();
        await SeedClienteAsync(db, negocioId, "Elena López", "55 1234 5678");

        var resolucion = await repo.ObtenerOCrearAsync(negocioId, "Elena López", "5512345678", null);

        resolucion.Resultado.Should().Be(ResultadoResolucionCliente.Creado);
    }

    [Fact]
    public async Task Reutiliza_CuandoFilaGuardadaTieneEspacios_YSeEnviaElMismoFormato()
    {
        var db = CreateDb();
        var repo = CreateRepo(db);
        var negocioId = Guid.NewGuid();
        var existente = await SeedClienteAsync(db, negocioId, "Elena López", "55 1234 5678");

        var resolucion = await repo.ObtenerOCrearAsync(negocioId, "Elena López", "55 1234 5678", null);

        resolucion.Resultado.Should().Be(ResultadoResolucionCliente.Encontrado);
        resolucion.Cliente.Id.Should().Be(existente.Id);
    }

    // ── Conflicto de nombre ───────────────────────────────────────────────────

    [Fact]
    public async Task ConflictoNombre_CuandoTelefonoCoincidePeroNombreEsDistinto()
    {
        var db = CreateDb();
        var repo = CreateRepo(db);
        var negocioId = Guid.NewGuid();
        var existente = await SeedClienteAsync(db, negocioId, "Elena López", "5512345678");

        var resolucion = await repo.ObtenerOCrearAsync(negocioId, "María Ramírez", "5512345678", null);

        resolucion.Resultado.Should().Be(ResultadoResolucionCliente.ConflictoNombre);
        resolucion.Cliente.Id.Should().Be(existente.Id);
        resolucion.Cliente.NombreCompleto.Should().Be("Elena López",
            "el llamador necesita el nombre en archivo para preguntar '¿eres tú?'");
        db.Clientes.Should().HaveCount(1);
    }

    [Fact]
    public async Task ConflictoNombre_NoModificaElClienteRegistrado()
    {
        var db = CreateDb();
        var repo = CreateRepo(db);
        var negocioId = Guid.NewGuid();
        await SeedClienteAsync(db, negocioId, "Elena López", "5512345678");

        await repo.ObtenerOCrearAsync(negocioId, "María Ramírez", "5512345678", "maria@email.com");

        var enBase = db.Clientes.Single();
        enBase.NombreCompleto.Should().Be("Elena López");
        enBase.Email.Should().BeNull("un conflicto no debe escribir nada en la fila existente");
    }

    [Fact]
    public async Task ConservaNombreRegistrado_CuandoSeAceptaElClienteExistente()
    {
        var db = CreateDb();
        var repo = CreateRepo(db);
        var negocioId = Guid.NewGuid();
        var existente = await SeedClienteAsync(db, negocioId, "Elena López", "5512345678");

        var resolucion = await repo.ObtenerOCrearAsync(
            negocioId, "María Ramírez", "5512345678", null, aceptarClienteExistente: true);

        resolucion.Resultado.Should().Be(ResultadoResolucionCliente.Encontrado);
        resolucion.Cliente.Id.Should().Be(existente.Id);
        resolucion.Cliente.NombreCompleto.Should().Be("Elena López",
            "decisión de producto: el nombre en archivo no se sobrescribe");
    }

    // ── Comparación tolerante de nombres ──────────────────────────────────────

    [Theory]
    [InlineData("Elena López", "Elena López")]
    [InlineData("Elena López", "elena lópez")]
    [InlineData("Elena López", "Elena Lopez")]
    [InlineData("Elena Lopez", "Elena López")]
    [InlineData("Elena López", "  Elena   López  ")]
    [InlineData("elena  lópez", "Elena Lopez")]
    [InlineData("José Ángel Muñoz", "jose angel munoz")]
    public async Task TrataComoMismoNombre_LasVariantesDeAcentoMayusculasYEspacios(
        string registrado, string enviado)
    {
        var db = CreateDb();
        var repo = CreateRepo(db);
        var negocioId = Guid.NewGuid();
        var existente = await SeedClienteAsync(db, negocioId, registrado, "5512345678");

        var resolucion = await repo.ObtenerOCrearAsync(negocioId, enviado, "5512345678", null);

        resolucion.Resultado.Should().Be(ResultadoResolucionCliente.Encontrado,
            "las variantes tipográficas del mismo nombre no deben disparar el conflicto");
        resolucion.Cliente.Id.Should().Be(existente.Id);
    }

    [Theory]
    [InlineData("Elena López", "Elena Martínez")]
    [InlineData("Elena López", "María López")]
    public async Task TrataComoNombreDistinto_LosNombresRealmenteDiferentes(
        string registrado, string enviado)
    {
        var db = CreateDb();
        var repo = CreateRepo(db);
        var negocioId = Guid.NewGuid();
        await SeedClienteAsync(db, negocioId, registrado, "5512345678");

        var resolucion = await repo.ObtenerOCrearAsync(negocioId, enviado, "5512345678", null);

        resolucion.Resultado.Should().Be(ResultadoResolucionCliente.ConflictoNombre);
    }

    // ── Sin teléfono ──────────────────────────────────────────────────────────

    [Fact]
    public async Task Crea_SinBuscar_CuandoNoSeEnviaTelefono()
    {
        var db = CreateDb();
        var repo = CreateRepo(db);
        var negocioId = Guid.NewGuid();
        await SeedClienteAsync(db, negocioId, "Elena López", null);

        var resolucion = await repo.ObtenerOCrearAsync(negocioId, "María Ramírez", null, null);

        resolucion.Resultado.Should().Be(ResultadoResolucionCliente.Creado);
        resolucion.Cliente.Telefono.Should().BeNull();
    }
}
