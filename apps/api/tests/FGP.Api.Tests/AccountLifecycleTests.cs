using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.WebUtilities;
using System.Text;
using Xunit;

namespace FGP.Api.Tests;

public sealed class AccountLifecycleTests
{
    [Fact]
    public async Task Register_creates_an_unverified_owner_and_sends_confirmation_link()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email = "owner@example.test",
            password = "CorrectHorseBatteryStaple1!",
            displayName = "Owner Example",
            organizationName = "Example Club",
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Single(app.EmailSender.Emails);
        Assert.Equal("confirmation", app.EmailSender.Emails[0].Kind);
        Assert.Equal("owner@example.test", app.EmailSender.Emails[0].Email);
    }

    [Fact]
    public async Task Sign_in_rejects_an_unverified_account_with_a_stable_error_code()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await client.PostAsJsonAsync("/api/auth/register", new
        {
            email = "owner@example.test",
            password = "CorrectHorseBatteryStaple1!",
            displayName = "Owner Example",
            organizationName = "Example Club",
        });

        var response = await client.PostAsJsonAsync("/api/auth/sign-in", new
        {
            email = "owner@example.test",
            password = "CorrectHorseBatteryStaple1!",
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiError>();
        Assert.Equal("EmailUnverified", body!.Code);
    }

    [Fact]
    public async Task Confirmed_account_can_sign_in_with_a_secure_cookie()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await client.PostAsJsonAsync("/api/auth/register", new
        {
            email = "owner@example.test",
            password = "CorrectHorseBatteryStaple1!",
            displayName = "Owner Example",
            organizationName = "Example Club",
        });
        var confirmationUri = new Uri(app.EmailSender.Emails.Single().Link);
        var query = QueryHelpers.ParseQuery(confirmationUri.Query);
        var encodedToken = query["token"].Single() ?? throw new InvalidOperationException("Confirmation token is missing.");

        var confirmation = await client.PostAsJsonAsync("/api/auth/verify-email", new
        {
            userId = query["userId"].Single(),
            token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(encodedToken)),
        });
        var signIn = await client.PostAsJsonAsync("/api/auth/sign-in", new
        {
            email = "owner@example.test",
            password = "CorrectHorseBatteryStaple1!",
        });

        Assert.Equal(HttpStatusCode.NoContent, confirmation.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, signIn.StatusCode);
        Assert.NotEmpty(signIn.Headers.GetValues("Set-Cookie"));

        var sessionResponse = await client.GetAsync("/api/auth/session");
        var session = await sessionResponse.Content.ReadFromJsonAsync<SessionResponse>();
        Assert.Equal(HttpStatusCode.OK, sessionResponse.StatusCode);
        Assert.Equal("owner@example.test", session!.User.Email);
        Assert.Equal("Example Club", session.ActiveOrganization.Name);
        Assert.Contains("CoSignFinancial", session.Capabilities);
    }
}

public sealed record ApiError(string Code, string Message);
public sealed record SessionResponse(SessionUser User, SessionOrganization ActiveOrganization, string[] Capabilities);
public sealed record SessionUser(string Id, string Email, string DisplayName);
public sealed record SessionOrganization(string Id, string Name, string Role);
