using System.Reflection;
using System.Text.RegularExpressions;
using AppointVaAPI.Constants;
using FluentAssertions;

namespace AppointVaAPI.Tests.Constants;

/// <summary>
/// The audit catalog is the single source for the audit page (filter and labels). These tests
/// keep it in sync with what the code actually writes.
/// </summary>
public class AccionesAuditoriaTests
{
    private static readonly string[] NoSonAcciones =
    [
        nameof(AccionesAuditoria.EntidadNegocio),
    ];

    private static List<(string Nombre, string Valor)> ConstantesDeAccion() =>
        typeof(AccionesAuditoria)
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(f => f.IsLiteral && f.FieldType == typeof(string))
            .Where(f => !f.Name.StartsWith("Grupo") && !NoSonAcciones.Contains(f.Name))
            .Select(f => (f.Name, (string)f.GetRawConstantValue()!))
            .ToList();

    [Fact]
    public void CadaConstante_TieneEtiquetaEnElCatalogo_YNoHayDuplicados()
    {
        var constantes = ConstantesDeAccion().Select(c => c.Valor).ToList();

        AccionesAuditoria.Catalogo.Select(a => a.Accion).Should().OnlyHaveUniqueItems()
            .And.BeEquivalentTo(constantes);
        AccionesAuditoria.Catalogo.Should().OnlyContain(a => !string.IsNullOrWhiteSpace(a.Etiqueta));
        AccionesAuditoria.Catalogo.Select(a => a.Grupo).Distinct()
            .Should().BeSubsetOf(AccionesAuditoria.Grupos.Select(g => g.Id));
    }

    [Fact]
    public void LasAccionesCabenEnLaColumna()
    {
        // AuditLog.Accion is varchar(100).
        AccionesAuditoria.Catalogo.Should().OnlyContain(a => a.Accion.Length <= 100);
    }

    [Fact]
    public void ElCodigo_NoEscribeAccionesConTextoLibre()
    {
        // Registrar*Async("Algo", ...) would write an action the catalog (and the audit page) does not know.
        // Only IAuditService and its AuditoriaAdmin extensions; other Registrar*Async helpers
        // (e.g. ReportesController.RegistrarExportacionAsync) take other text first.
        var literal = new Regex(@"\b(RegistrarAsync|RegistrarObligatorioAsync|RegistrarNegocioAsync|RegistrarNegocioObligatorioAsync)\(\s*""",
            RegexOptions.Compiled);
        var infractores = ArchivosFuente()
            .Where(f => !f.EndsWith("AuditService.cs") && !f.EndsWith("IAuditService.cs"))
            .Where(f => literal.IsMatch(File.ReadAllText(f)))
            .Select(Path.GetFileName)
            .ToList();

        infractores.Should().BeEmpty("every audit call must use an AccionesAuditoria constant");
    }

    [Fact]
    public void CadaAccionDelCatalogo_SeEscribeEnAlgunLugar()
    {
        // A catalog entry nobody writes would be a filter option that always returns zero rows.
        var codigo = string.Join("\n", ArchivosFuente()
            .Where(f => !f.EndsWith("AccionesAuditoria.cs"))
            .Select(File.ReadAllText));

        var sinUso = ConstantesDeAccion()
            .Where(c => !codigo.Contains($"AccionesAuditoria.{c.Nombre}"))
            .Select(c => c.Nombre)
            .ToList();

        sinUso.Should().BeEmpty();
    }

    private static IEnumerable<string> ArchivosFuente()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "AppointVaAPI", "Controllers")))
            dir = dir.Parent;
        dir.Should().NotBeNull("the API source folder must be reachable from the test output");

        var raiz = Path.Combine(dir!.FullName, "AppointVaAPI");
        return Directory.EnumerateFiles(raiz, "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}")
                     && !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}")
                     && !f.Contains($"{Path.DirectorySeparatorChar}Migrations{Path.DirectorySeparatorChar}"));
    }
}
