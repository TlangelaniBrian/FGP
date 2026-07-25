using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.DependencyInjection;
using FGP.Api.Data;
using FGP.Api.Identity;
using FGP.Api.Organizations;
using Microsoft.EntityFrameworkCore;
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

    [Fact]
    public async Task Only_the_owner_can_transfer_ownership_and_the_transfer_keeps_one_active_owner()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var ownerClient = app.CreateClient();
        await RegisterConfirmAndSignInAsync(ownerClient, app);
        await ownerClient.PostAsJsonAsync("/api/organizations/invitations", new
        {
            email = "chair@example.test",
            role = "Chairperson",
        });
        var chairClient = app.CreateClient();
        await RegisterConfirmAndSignInInvitationAsync(chairClient, app, "chair@example.test");
        var chairMembership = await GetMembershipAsync(app, "chair@example.test");

        var forbidden = await chairClient.PostAsJsonAsync($"/api/organizations/members/{chairMembership.Id}/transfer-ownership", new
        {
            previousOwnerRole = "Treasurer",
        });
        var transfer = await ownerClient.PostAsJsonAsync($"/api/organizations/members/{chairMembership.Id}/transfer-ownership", new
        {
            previousOwnerRole = "Treasurer",
        });

        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        Assert.True(transfer.IsSuccessStatusCode, await transfer.Content.ReadAsStringAsync());

        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        var memberships = await database.Memberships
            .Where(member => member.Status == MembershipStatus.Active)
            .ToListAsync();
        var activeOwner = Assert.Single(memberships, member => member.Role == OrganizationRole.Owner);
        Assert.Equal(chairMembership.UserId, activeOwner.UserId);
        Assert.Contains(await database.ActivityEvents.ToListAsync(), activity => activity.EventType == "team_ownership_transfer");
    }

    [Fact]
    public async Task Team_management_cannot_demote_the_active_owner_without_an_ownership_transfer()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var ownerClient = app.CreateClient();
        await RegisterConfirmAndSignInAsync(ownerClient, app);
        var ownerMembership = await GetMembershipAsync(app, "owner@example.test");

        var response = await ownerClient.PatchAsJsonAsync($"/api/organizations/members/{ownerMembership.Id}", new
        {
            role = "Treasurer",
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
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

    private static async Task RegisterConfirmAndSignInInvitationAsync(HttpClient client, IdentityApiFactory app, string email)
    {
        var invitationLink = app.EmailSender.Emails.Single(message => message.Kind == "invitation" && message.Email == email).Link;
        var invitationToken = new Uri(invitationLink).Segments.Last();
        await client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "CorrectHorseBatteryStaple1!",
            displayName = "Chair Example",
            organizationName = "Ignored for an invitation",
            invitationToken,
        });
        var confirmationUri = new Uri(app.EmailSender.Emails.Last(message => message.Kind == "confirmation" && message.Email == email).Link);
        var confirmationQuery = QueryHelpers.ParseQuery(confirmationUri.Query);
        await client.PostAsJsonAsync("/api/auth/verify-email", new
        {
            userId = confirmationQuery["userId"].Single(),
            token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(confirmationQuery["token"].Single()!)),
        });
        await client.PostAsJsonAsync("/api/auth/sign-in", new
        {
            email,
            password = "CorrectHorseBatteryStaple1!",
        });
    }

    private static async Task<Membership> GetMembershipAsync(IdentityApiFactory app, string email)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        return await database.Memberships
            .Join(database.Users,
                membership => membership.UserId,
                user => user.Id,
                (membership, user) => new { membership, user.Email })
            .Where(candidate => candidate.Email == email)
            .Select(candidate => candidate.membership)
            .SingleAsync();
    }
}
