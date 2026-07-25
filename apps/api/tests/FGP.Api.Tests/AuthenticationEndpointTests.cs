using System.Net;
using Xunit;

namespace FGP.Api.Tests;

public sealed class AuthenticationEndpointTests
{
    [Fact]
    public async Task GetSession_returns_unauthorized_without_an_authenticated_identity()
    {
        await using var app = new FgpApiFactory();

        var response = await app.CreateClient().GetAsync("/api/auth/session");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
