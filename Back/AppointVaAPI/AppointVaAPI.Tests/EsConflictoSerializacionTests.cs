using System.Reflection;
using AppointVaAPI.Controllers.V1;
using FluentAssertions;

namespace AppointVaAPI.Tests;

public class EsConflictoSerializacionTests
{
    private static readonly MethodInfo _metodo =
        typeof(PublicoController)
            .GetMethod("EsConflictoSerializacion", BindingFlags.NonPublic | BindingFlags.Static)!;

    private static bool Invocar(Exception ex) =>
        (bool)_metodo.Invoke(null, [ex])!;

    [Fact]
    public void Con_Excepcion_Postgres_Codigo_40001_Retorna_True()
    {
        // La producción requiere: tipo contiene "Postgres" Y mensaje contiene "40001"
        var ex = new FakePostgresException("ERROR 40001: could not serialize");
        Invocar(ex).Should().BeTrue();
    }

    [Fact]
    public void Con_Excepcion_Postgres_Palabra_Serialization_Retorna_True()
    {
        var ex = new FakePostgresException("serialization failure on transaction");
        Invocar(ex).Should().BeTrue("tipo Postgres + mensaje 'serialization'");
    }

    [Fact]
    public void Con_Excepcion_Postgres_Palabra_Deadlock_Retorna_True()
    {
        var ex = new FakePostgresException("deadlock detected");
        Invocar(ex).Should().BeTrue("tipo Postgres + mensaje 'deadlock'");
    }

    [Fact]
    public void Con_Excepcion_NoPostgres_Con_Codigo_40001_Retorna_False()
    {
        // Sin "Postgres" en el nombre del tipo → false, aunque el mensaje tenga 40001
        var ex = new InvalidOperationException("ERROR 40001: serialization failure");
        Invocar(ex).Should().BeFalse("el tipo no contiene 'Postgres'");
    }

    [Fact]
    public void Con_Excepcion_Normal_Retorna_False()
    {
        var ex = new InvalidOperationException("operación no válida");
        Invocar(ex).Should().BeFalse();
    }

    [Fact]
    public void Con_Excepcion_Anidada_Postgres_Retorna_True()
    {
        var inner = new FakePostgresException("ERROR 40001: serialization failure");
        var outer = new Exception("outer", inner);
        Invocar(outer).Should().BeTrue("la excepción interna tiene nombre 'Postgres' y código 40001");
    }

    [Fact]
    public void Con_Excepcion_Anidada_Sin_Postgres_Retorna_False()
    {
        var inner = new ArgumentException("parámetro nulo");
        var outer = new Exception("outer", inner);
        Invocar(outer).Should().BeFalse();
    }

    /// <summary>Simula excepción cuyo tipo contiene "Postgres" en el nombre.</summary>
    private class FakePostgresException(string message) : Exception(message)
    {
        // El tipo se llama FakePostgresException → contiene "Postgres"
    }
}
