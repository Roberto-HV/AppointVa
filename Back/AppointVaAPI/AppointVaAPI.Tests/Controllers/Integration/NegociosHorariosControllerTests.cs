using System.Net;
using System.Net.Http.Json;
using System.Text;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Horarios;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class NegociosHorariosControllerTests : IntegrationTestBase
{
    public NegociosHorariosControllerTests(CustomWebApplicationFactory factory)
        : base(factory) { }

    // ── Group B — PUT /api/negocios/perfil/horarios validation ──────────────────

    [Fact]
    public async Task PutHorarios_HoraInicioMayorQueHoraFin_Retorna400()
    {
        // B1 — horaInicio >= horaFin returns 400
        var client = NewClient(TestTokenHelper.Propietario());
        var body = new StringContent(
            """[{"diaSemana":1,"activo":true,"intervalos":[{"horaInicio":"14:00","horaFin":"09:00"}]}]""",
            Encoding.UTF8, "application/json");

        var response = await client.PutAsync("/api/negocios/perfil/horarios", body);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PutHorarios_IntervalosSuperpuestos_Retorna400()
    {
        // B2 — Two overlapping intervals on the same day returns 400
        var client = NewClient(TestTokenHelper.Propietario());
        var body = new StringContent(
            """[{"diaSemana":1,"activo":true,"intervalos":[{"horaInicio":"09:00","horaFin":"13:00"},{"horaInicio":"12:00","horaFin":"17:00"}]}]""",
            Encoding.UTF8, "application/json");

        var response = await client.PutAsync("/api/negocios/perfil/horarios", body);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PutHorarios_DiaSemanasDuplicados_Retorna400()
    {
        // B3 — Duplicate diaSemana entries in payload returns 400
        var client = NewClient(TestTokenHelper.Propietario());
        var body = new StringContent(
            """[{"diaSemana":1,"activo":true,"intervalos":[{"horaInicio":"09:00","horaFin":"12:00"}]},{"diaSemana":1,"activo":true,"intervalos":[{"horaInicio":"13:00","horaFin":"17:00"}]}]""",
            Encoding.UTF8, "application/json");

        var response = await client.PutAsync("/api/negocios/perfil/horarios", body);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PutHorarios_DiaSemanaFueraDeLimite_Retorna400()
    {
        // B4 — diaSemana > 6 returns 400
        var client = NewClient(TestTokenHelper.Propietario());
        var body = new StringContent(
            """[{"diaSemana":7,"activo":true,"intervalos":[{"horaInicio":"09:00","horaFin":"17:00"}]}]""",
            Encoding.UTF8, "application/json");

        var response = await client.PutAsync("/api/negocios/perfil/horarios", body);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PutHorarios_ActivoFalse_BorraIntervalosExistentes()
    {
        // B5 — Full replace: existing interval deleted when day sent with activo: false
        var negocioId = Guid.NewGuid();
        var token = TestTokenHelper.GenerarToken("Propietario", negocioId);
        var client = NewClient(token);

        // Seed a HorarioNegocio row for diaSemana=1 (Monday), Activo=1
        await using (var scope = Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.HorariosNegocios.Add(new HorarioNegocio
            {
                Id = Guid.NewGuid(),
                NegocioId = negocioId,
                DiaSemana = 1,
                HoraInicio = new TimeSpan(9, 0, 0),
                HoraFin = new TimeSpan(17, 0, 0),
                Activo = 1,
            });
            await db.SaveChangesAsync();
        }

        // PUT with activo: false — must delete the seeded row
        var putBody = new StringContent(
            """[{"diaSemana":1,"activo":false,"intervalos":[]}]""",
            Encoding.UTF8, "application/json");
        var putResponse = await client.PutAsync("/api/negocios/perfil/horarios", putBody);
        putResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // GET to verify the row is gone and the day is reported as inactive
        var getResponse = await client.GetAsync("/api/negocios/perfil/horarios");
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var horarios = await getResponse.Content.ReadFromJsonAsync<List<HorarioDiaDto>>();
        var lunes = horarios!.Single(h => h.DiaSemana == 1);
        lunes.Activo.Should().BeFalse("el intervalo fue eliminado al enviar activo=false");
        lunes.Intervalos.Should().BeEmpty("no quedan filas para diaSemana=1 tras el full-replace");
    }

    [Fact]
    public async Task PutHorarios_DosIntervalosDiaValido_SeGuardanYGetLoRetorna()
    {
        // B6 — Valid two-interval day saves and is returned by GET
        var negocioId = Guid.NewGuid();
        var token = TestTokenHelper.GenerarToken("Propietario", negocioId);
        var client = NewClient(token);

        var putBody = new StringContent(
            """[{"diaSemana":2,"activo":true,"intervalos":[{"horaInicio":"09:00","horaFin":"12:00"},{"horaInicio":"14:00","horaFin":"18:00"}]}]""",
            Encoding.UTF8, "application/json");
        var putResponse = await client.PutAsync("/api/negocios/perfil/horarios", putBody);
        putResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // GET to verify both intervals are persisted
        var getResponse = await client.GetAsync("/api/negocios/perfil/horarios");
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var horarios = await getResponse.Content.ReadFromJsonAsync<List<HorarioDiaDto>>();
        var martes = horarios!.Single(h => h.DiaSemana == 2);
        martes.Activo.Should().BeTrue();
        martes.Intervalos.Should().HaveCount(2);
        martes.Intervalos[0].HoraInicio.Should().Be("09:00");
        martes.Intervalos[0].HoraFin.Should().Be("12:00");
        martes.Intervalos[1].HoraInicio.Should().Be("14:00");
        martes.Intervalos[1].HoraFin.Should().Be("18:00");
    }
}
