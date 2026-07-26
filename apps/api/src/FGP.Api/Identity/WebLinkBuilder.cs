using Microsoft.AspNetCore.WebUtilities;

namespace FGP.Api.Identity;

internal static class WebLinkBuilder
{
    public static string Build(
        IConfiguration configuration,
        HttpRequest request,
        string path,
        IReadOnlyDictionary<string, string?>? query = null)
    {
        var configuredOrigin = configuration["Web:PublicOrigin"]?.TrimEnd('/');
        var origin = string.IsNullOrWhiteSpace(configuredOrigin)
            ? $"{request.Scheme}://{request.Host}"
            : configuredOrigin;
        var link = $"{origin}{path}";
        return query is null ? link : QueryHelpers.AddQueryString(link, query);
    }
}
