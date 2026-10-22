using Microsoft.AspNetCore.HttpOverrides;

namespace AppointVaAPI.Helpers;

/// <summary>
/// Forwarded-headers setup for running behind Render's reverse proxy. Without it every
/// request's Connection.RemoteIpAddress is the proxy's address, so the per-IP rate-limit
/// policies would put all users in the same bucket and the audit log would record the proxy.
/// </summary>
public static class ProxyReenvioOpciones
{
    /// <summary>Config key (env var <c>ForwardedHeaders__Enabled</c>) to force the middleware on or off.</summary>
    public const string ClaveHabilitado = "ForwardedHeaders:Enabled";

    /// <summary>
    /// Enabled by default only in Production (Render). Set the flag explicitly to enable it in a
    /// proxied staging host or to disable it when the API is exposed directly: trusting
    /// X-Forwarded-For without a proxy in front lets any client pick its own IP.
    /// </summary>
    public static bool EstaHabilitado(IConfiguration configuracion, IHostEnvironment entorno) =>
        configuracion.GetValue<bool?>(ClaveHabilitado) ?? entorno.IsProduction();

    public static void Configurar(ForwardedHeadersOptions opciones)
    {
        opciones.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;

        // Render's proxy addresses are not fixed or published, so the default allow-list
        // (loopback only) would make the middleware ignore every forwarded header.
        opciones.KnownIPNetworks.Clear();
        opciones.KnownProxies.Clear();

        // Trust exactly one hop: the entry Render appends at the right end of X-Forwarded-For.
        // Anything to its left came from the client and can be spoofed, so it is never used
        // (e.g. "9.9.9.9, 1.2.3.4" resolves to 1.2.3.4). Raise this only if another proxy
        // (e.g. a CDN) is added in front of Render.
        opciones.ForwardLimit = 1;
    }
}
