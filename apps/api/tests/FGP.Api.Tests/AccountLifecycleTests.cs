using System.Net;
using System.Net.Http.Json;
using FGP.Api.Identity;
using FGP.Api.Organizations;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using System.Security.Claims;
using System.Text.Json;
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
        Assert.Equal("/verify-email", new Uri(app.EmailSender.Emails[0].Link).AbsolutePath);
    }

    [Fact]
    public async Task Register_uses_a_neutral_success_response_for_an_existing_email()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        var request = new
        {
            email = "owner@example.test",
            password = "CorrectHorseBatteryStaple1!",
            displayName = "Owner Example",
            organizationName = "Example Club",
        };

        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/auth/register", request)).StatusCode);
        var duplicate = await client.PostAsJsonAsync("/api/auth/register", request);

        Assert.Equal(HttpStatusCode.Created, duplicate.StatusCode);
        using var body = JsonDocument.Parse(await duplicate.Content.ReadAsStringAsync());
        Assert.True(body.RootElement.GetProperty("requiresEmailVerification").GetBoolean());
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
    public async Task Sign_in_does_not_disclose_email_confirmation_for_a_wrong_password()
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
            password = "WrongPassword1!",
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("InvalidCredentials", (await response.Content.ReadFromJsonAsync<ApiError>())!.Code);
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
        Assert.NotEqual(Guid.Empty, session.MembershipId);
        Assert.Contains("CoSignFinancial", session.Capabilities);
    }

    [Fact]
    public async Task Sign_in_enables_identity_lockout_after_repeated_failures()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await RegisterAndConfirmAsync(client, app);

        for (var attempt = 0; attempt < 5; attempt++)
        {
            var failed = await client.PostAsJsonAsync("/api/auth/sign-in", new
            {
                email = "owner@example.test",
                password = "WrongPassword1!",
            });
            Assert.Equal(attempt < 4 ? HttpStatusCode.Unauthorized : HttpStatusCode.TooManyRequests, failed.StatusCode);
            if (attempt == 4)
            {
                Assert.Equal("AccountLocked", (await failed.Content.ReadFromJsonAsync<ApiError>())!.Code);
            }
        }

        var locked = await client.PostAsJsonAsync("/api/auth/sign-in", new
        {
            email = "owner@example.test",
            password = "CorrectHorseBatteryStaple1!",
        });

        Assert.Equal(HttpStatusCode.TooManyRequests, locked.StatusCode);
        Assert.Equal("AccountLocked", (await locked.Content.ReadFromJsonAsync<ApiError>())!.Code);
    }

    [Fact]
    public async Task Claims_factory_rehydrates_the_active_organization_and_role()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        var actor = await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);

        await using var scope = app.Services.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var factory = scope.ServiceProvider.GetRequiredService<IUserClaimsPrincipalFactory<ApplicationUser>>();
        var user = await users.FindByIdAsync(actor.UserId.ToString());
        var principal = await factory.CreateAsync(user!);

        Assert.Equal(actor.OrganizationId.ToString(), principal.FindFirstValue("organization_id"));
        Assert.Equal(OrganizationRole.Owner.ToString(), principal.FindFirstValue(ClaimTypes.Role));
    }

    [Fact]
    public async Task Password_reset_token_is_single_use()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await RegisterAndConfirmAsync(client, app);

        var recovery = await client.PostAsJsonAsync("/api/auth/password-recovery", new { email = "owner@example.test" });
        Assert.Equal(HttpStatusCode.NoContent, recovery.StatusCode);
        var resetUri = new Uri(app.EmailSender.Emails.Single(email => email.Kind == "password-reset").Link);
        Assert.Equal("/password-reset", resetUri.AbsolutePath);
        var resetQuery = QueryHelpers.ParseQuery(resetUri.Query);
        var resetToken = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(resetQuery["token"].Single()!));
        var request = new
        {
            userId = resetQuery["userId"].Single(),
            token = resetToken,
            newPassword = "UpdatedCorrectHorseBatteryStaple1!",
        };

        var reset = await client.PostAsJsonAsync("/api/auth/password-reset", request);
        var replay = await client.PostAsJsonAsync("/api/auth/password-reset", request);
        var signIn = await client.PostAsJsonAsync("/api/auth/sign-in", new
        {
            email = "owner@example.test",
            password = "UpdatedCorrectHorseBatteryStaple1!",
        });

        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, replay.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, signIn.StatusCode);
    }

    [Fact]
    public async Task Verification_resend_sends_a_fresh_web_completion_link()
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

        var response = await client.PostAsJsonAsync("/api/auth/verification-resend", new
        {
            email = "owner@example.test",
        });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var messages = app.EmailSender.Emails.Where(email => email.Kind == "confirmation").ToArray();
        Assert.Equal(2, messages.Length);
        Assert.Equal("/verify-email", new Uri(messages[1].Link).AbsolutePath);
    }

    [Fact]
    public async Task Sign_out_invalidates_the_session_cookie()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await RegisterAndConfirmAsync(client, app);
        await client.PostAsJsonAsync("/api/auth/sign-in", new
        {
            email = "owner@example.test",
            password = "CorrectHorseBatteryStaple1!",
        });

        var signOut = await client.PostAsync("/api/auth/sign-out", null);
        var session = await client.GetAsync("/api/auth/session");

        Assert.Equal(HttpStatusCode.NoContent, signOut.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, session.StatusCode);
    }

    private static async Task RegisterAndConfirmAsync(HttpClient client, IdentityApiFactory app)
    {
        await client.PostAsJsonAsync("/api/auth/register", new
        {
            email = "owner@example.test",
            password = "CorrectHorseBatteryStaple1!",
            displayName = "Owner Example",
            organizationName = "Example Club",
        });
        var confirmationUri = new Uri(app.EmailSender.Emails.Single().Link);
        var confirmationQuery = QueryHelpers.ParseQuery(confirmationUri.Query);
        var confirmationToken = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(confirmationQuery["token"].Single()!));
        await client.PostAsJsonAsync("/api/auth/verify-email", new
        {
            userId = confirmationQuery["userId"].Single(),
            token = confirmationToken,
        });
    }
}

public sealed record ApiError(string Code, string Message);
public sealed record SessionResponse(Guid MembershipId, SessionUser User, SessionOrganization ActiveOrganization, string[] Capabilities);
public sealed record SessionUser(string Id, string Email, string DisplayName);
public sealed record SessionOrganization(string Id, string Name, string Role);
