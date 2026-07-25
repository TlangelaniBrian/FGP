using Microsoft.AspNetCore.WebUtilities;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using Xunit;

namespace FGP.Api.Tests;

public sealed class OrganizationEndpointTests
{
    [Fact]
    public async Task Active_owner_can_create_a_chairperson_invitation()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await RegisterConfirmAndSignInAsync(client, app);

        var response = await client.PostAsJsonAsync("/api/organizations/invitations", new
        {
            email = "chair@example.test",
            role = "Chairperson",
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var email = app.EmailSender.Emails.Single(message => message.Kind == "invitation");
        Assert.Equal("chair@example.test", email.Email);
        Assert.Contains("/invitations/", email.Link);
    }

    [Fact]
    public async Task Invitation_token_registers_a_chairperson_in_the_inviting_organization()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var ownerClient = app.CreateClient();
        await RegisterConfirmAndSignInAsync(ownerClient, app);
        await ownerClient.PostAsJsonAsync("/api/organizations/invitations", new
        {
            email = "chair@example.test",
            role = "Chairperson",
        });
        var invitationLink = app.EmailSender.Emails.Single(message => message.Kind == "invitation").Link;
        var invitationToken = new Uri(invitationLink).Segments.Last();
        var chairClient = app.CreateClient();

        var registration = await chairClient.PostAsJsonAsync("/api/auth/register", new
        {
            email = "chair@example.test",
            password = "CorrectHorseBatteryStaple1!",
            displayName = "Chair Example",
            organizationName = "Ignored for an invitation",
            invitationToken,
        });
        var confirmationUri = new Uri(app.EmailSender.Emails.Last(message => message.Kind == "confirmation").Link);
        var confirmationQuery = QueryHelpers.ParseQuery(confirmationUri.Query);
        await chairClient.PostAsJsonAsync("/api/auth/verify-email", new
        {
            userId = confirmationQuery["userId"].Single(),
            token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(confirmationQuery["token"].Single()!)),
        });
        var signIn = await chairClient.PostAsJsonAsync("/api/auth/sign-in", new
        {
            email = "chair@example.test",
            password = "CorrectHorseBatteryStaple1!",
        });
        var session = await chairClient.GetFromJsonAsync<SessionResponse>("/api/auth/session");

        Assert.Equal(HttpStatusCode.Created, registration.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, signIn.StatusCode);
        Assert.Equal("Example Club", session!.ActiveOrganization.Name);
        Assert.Equal("Chairperson", session.ActiveOrganization.Role);
        Assert.Contains("CoSignFinancial", session.Capabilities);
    }

    private static async Task RegisterConfirmAndSignInAsync(HttpClient client, IdentityApiFactory app)
    {
        await client.PostAsJsonAsync("/api/auth/register", new
        {
            email = "owner@example.test",
            password = "CorrectHorseBatteryStaple1!",
            displayName = "Owner Example",
            organizationName = "Example Club",
        });
        var confirmationUri = new Uri(app.EmailSender.Emails.Single().Link);
        var query = QueryHelpers.ParseQuery(confirmationUri.Query);
        var token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(query["token"].Single()!));
        await client.PostAsJsonAsync("/api/auth/verify-email", new
        {
            userId = query["userId"].Single(),
            token,
        });
        await client.PostAsJsonAsync("/api/auth/sign-in", new
        {
            email = "owner@example.test",
            password = "CorrectHorseBatteryStaple1!",
        });
    }
}
