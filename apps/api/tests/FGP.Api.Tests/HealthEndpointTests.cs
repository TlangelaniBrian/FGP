using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace FGP.Api.Tests;

public sealed class HealthEndpointTests
{
    [Fact]
    public async Task GetHealth_returns_ok()
    {
        await using var app = new FgpApiFactory();

        var response = await app.CreateClient().GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("ok", (await response.Content.ReadFromJsonAsync<HealthResponse>())!.Status);
    }
}

public sealed class FgpApiFactory : WebApplicationFactory<global::Program>;

public sealed record HealthResponse(string Status);
