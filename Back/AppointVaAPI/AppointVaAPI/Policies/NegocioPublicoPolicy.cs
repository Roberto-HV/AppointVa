using Microsoft.AspNetCore.OutputCaching;

namespace AppointVaAPI.Policies;

/// <summary>
/// Tags the cached public business page with <c>negocio-{slug}</c> so owner edits can
/// evict it with <see cref="IOutputCacheStore.EvictByTagAsync"/>. It only adds the tag:
/// it is registered through <see cref="OutputCachePolicyBuilder"/> (see Program.cs), whose
/// built-in default policy decides what may be cached (anonymous GET/HEAD, 200 responses
/// without Set-Cookie, varying by query string). On its own this policy never sets
/// AllowCacheLookup/AllowCacheStorage, so nothing would be cached.
/// </summary>
public sealed class NegocioPublicoPolicy : IOutputCachePolicy
{
    public ValueTask CacheRequestAsync(OutputCacheContext context, CancellationToken ct)
    {
        var slug = context.HttpContext.GetRouteValue("slug")?.ToString();
        if (!string.IsNullOrEmpty(slug))
            context.Tags.Add($"negocio-{slug}");
        return ValueTask.CompletedTask;
    }

    public ValueTask ServeFromCacheAsync(OutputCacheContext context, CancellationToken ct)
        => ValueTask.CompletedTask;

    public ValueTask ServeResponseAsync(OutputCacheContext context, CancellationToken ct)
        => ValueTask.CompletedTask;
}
