using Microsoft.AspNetCore.OutputCaching;

namespace AppointVaAPI.Policies;

public sealed class NegocioPublicoPolicy : IOutputCachePolicy
{
    public static readonly NegocioPublicoPolicy Instance = new();

    public ValueTask CacheRequestAsync(OutputCacheContext context, CancellationToken ct)
    {
        var slug = context.HttpContext.GetRouteValue("slug")?.ToString();
        if (!string.IsNullOrEmpty(slug))
            context.Tags.Add($"negocio-{slug}");

        context.EnableOutputCaching = true;
        context.ResponseExpirationTimeSpan = TimeSpan.FromMinutes(5);
        return ValueTask.CompletedTask;
    }

    public ValueTask ServeFromCacheAsync(OutputCacheContext context, CancellationToken ct)
        => ValueTask.CompletedTask;

    public ValueTask ServeResponseAsync(OutputCacheContext context, CancellationToken ct)
        => ValueTask.CompletedTask;
}
