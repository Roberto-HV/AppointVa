using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;

namespace AppointVaAPI.Tests.Controllers.Integration;

/// <summary>S2: the Hangfire dashboard is reached through a single-use ticket, never a JWT in the URL.</summary>
public class HangfireAccesoIntegrationTests : IntegrationTestBase
{
    public HangfireAccesoIntegrationTests(CustomWebApplicationFactory factory) : base(factory) { }

    private sealed record TicketResponse(string Ticket, int ExpiraEnSegundos);

    private HttpClient ClienteSinRedirect() =>
        Factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    private async Task<string> PedirTicketAsync()
    {
        SetToken(TestTokenHelper.SuperAdmin());
        var resp = await Client.PostAsync("/api/admin/hangfire/ticket", null);
        resp.StatusCode.Should().Be(HttpStatusCode.OK, await resp.Content.ReadAsStringAsync());
        var body = await resp.Content.ReadFromJsonAsync<TicketResponse>();
        return body!.Ticket;
    }

    private static string? CookieSesion(HttpResponseMessage resp) =>
        resp.Headers.TryGetValues("Set-Cookie", out var cookies)
            ? cookies.FirstOrDefault(c => c.StartsWith("hangfire_session="))
            : null;

    [Fact]
    public async Task Ticket_SinToken_Retorna401()
    {
        ClearToken();
        var resp = await Client.PostAsync("/api/admin/hangfire/ticket", null);
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Theory]
    [InlineData("Propietario")]
    [InlineData("Empleado")]
    public async Task Ticket_RolNoSuperAdmin_Retorna403(string rol)
    {
        SetToken(TestTokenHelper.GenerarToken(rol));
        var resp = await Client.PostAsync("/api/admin/hangfire/ticket", null);
        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Ticket_SuperAdmin_DevuelveTicketOpacoDe60s()
    {
        SetToken(TestTokenHelper.SuperAdmin());
        var resp = await Client.PostAsync("/api/admin/hangfire/ticket", null);

        resp.StatusCode.Should().Be(HttpStatusCode.OK, await resp.Content.ReadAsStringAsync());
        resp.Headers.CacheControl!.NoStore.Should().BeTrue();
        var body = await resp.Content.ReadFromJsonAsync<TicketResponse>();
        body!.ExpiraEnSegundos.Should().Be(60);
        body.Ticket.Split('.').Should().HaveCount(1, "the ticket must not be a JWT");
    }

    [Fact]
    public async Task Sesion_TicketValido_PoneCookieHttpOnlyYRedirige()
    {
        var ticket = await PedirTicketAsync();

        var resp = await ClienteSinRedirect().GetAsync($"/hangfire-session?ticket={Uri.EscapeDataString(ticket)}");

        resp.StatusCode.Should().Be(HttpStatusCode.Redirect);
        resp.Headers.Location!.ToString().Should().Be("/hangfire");
        var cookie = CookieSesion(resp);
        cookie.Should().NotBeNull();
        cookie!.ToLowerInvariant().Should().Contain("httponly").And.Contain("secure")
            .And.Contain("samesite=lax").And.Contain("path=/hangfire");
        cookie.Should().NotContain(ticket);
    }

    [Fact]
    public async Task Sesion_TicketReutilizado_NoPoneCookie()
    {
        var ticket = await PedirTicketAsync();
        var cliente = ClienteSinRedirect();

        (await cliente.GetAsync($"/hangfire-session?ticket={Uri.EscapeDataString(ticket)}")).Dispose();
        var segunda = await cliente.GetAsync($"/hangfire-session?ticket={Uri.EscapeDataString(ticket)}");

        segunda.StatusCode.Should().Be(HttpStatusCode.Redirect);
        CookieSesion(segunda).Should().BeNull();
    }

    [Fact]
    public async Task Sesion_ConJwtEnLaUrl_YaNoSeAcepta()
    {
        var jwt = TestTokenHelper.SuperAdmin();

        var porToken  = await ClienteSinRedirect().GetAsync($"/hangfire-session?token={jwt}");
        var porTicket = await ClienteSinRedirect().GetAsync($"/hangfire-session?ticket={jwt}");

        CookieSesion(porToken).Should().BeNull();
        CookieSesion(porTicket).Should().BeNull();
        porToken.Headers.TryGetValues("Set-Cookie", out var c1);
        (c1 ?? []).Should().NotContain(c => c.Contains(jwt));
    }
}
