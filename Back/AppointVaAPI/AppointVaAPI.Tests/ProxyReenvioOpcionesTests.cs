using System.Net;
using AppointVaAPI.Helpers;
using FluentAssertions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using NSubstitute;

namespace AppointVaAPI.Tests;

/// <summary>
/// The Testing host leaves forwarded headers off (no proxy in front), so the options
/// Program.cs registers are exercised on a minimal TestServer pipeline that mirrors it:
/// UseForwardedHeaders first, then an endpoint that echoes the resolved client IP.
/// </summary>
public class ProxyReenvioOpcionesTests
{
    private static readonly IPAddress IpProxyRender = IPAddress.Parse("10.0.0.7");

    private static async Task<(string Ip, string Esquema)> ResolverAsync(string xForwardedFor)
    {
        using var host = await new HostBuilder()
            .ConfigureWebHost(web => web
                .UseTestServer()
                .ConfigureServices(s => s.Configure<ForwardedHeadersOptions>(ProxyReenvioOpciones.Configurar))
                .Configure(app =>
                {
                    // TestServer has no socket: simulate the connection coming from Render's proxy.
                    app.Use((ctx, next) =>
                    {
                        ctx.Connection.RemoteIpAddress = IpProxyRender;
                        return next(ctx);
                    });
                    app.UseForwardedHeaders();
                    app.Run(ctx => ctx.Response.WriteAsync(
                        $"{ctx.Connection.RemoteIpAddress}|{ctx.Request.Scheme}"));
                }))
            .StartAsync();

        var request = new HttpRequestMessage(HttpMethod.Get, "/");
        request.Headers.TryAddWithoutValidation("X-Forwarded-For", xForwardedFor);
        request.Headers.TryAddWithoutValidation("X-Forwarded-Proto", "https");

        var response = await host.GetTestClient().SendAsync(request);
        var partes = (await response.Content.ReadAsStringAsync()).Split('|');
        return (partes[0], partes[1]);
    }

    [Fact]
    public async Task UnSoloSalto_ResuelveLaIpDelCliente()
    {
        var (ip, esquema) = await ResolverAsync("1.2.3.4");

        ip.Should().Be("1.2.3.4");
        esquema.Should().Be("https");
    }

    [Fact]
    public async Task CadenaFalsificada_SoloConfiaEnElSaltoMasALaDerecha()
    {
        var (ip, _) = await ResolverAsync("9.9.9.9, 1.2.3.4");

        ip.Should().Be("1.2.3.4", "the leftmost value is client-supplied and must be ignored");
    }

    [Fact]
    public void Configurar_ConfiaEnUnSaltoDeCualquierProxy()
    {
        var opciones = new ForwardedHeadersOptions();

        ProxyReenvioOpciones.Configurar(opciones);

        opciones.ForwardLimit.Should().Be(1);
        opciones.KnownIPNetworks.Should().BeEmpty();
        opciones.KnownProxies.Should().BeEmpty();
    }

    [Theory]
    [InlineData("Production", null, true)]
    [InlineData("Development", null, false)]
    [InlineData("Testing", null, false)]
    [InlineData("Production", "false", false)]
    [InlineData("Staging", "true", true)]
    public void EstaHabilitado_PorDefectoSoloEnProduccion(string entorno, string? flag, bool esperado)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(flag is null
                ? []
                : new Dictionary<string, string?> { [ProxyReenvioOpciones.ClaveHabilitado] = flag })
            .Build();
        var env = Substitute.For<IHostEnvironment>();
        env.EnvironmentName.Returns(entorno);

        ProxyReenvioOpciones.EstaHabilitado(config, env).Should().Be(esperado);
    }
}
