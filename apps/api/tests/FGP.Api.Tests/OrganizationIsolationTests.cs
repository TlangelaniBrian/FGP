using FGP.Api.Data;
using FGP.Api.Identity;
using FGP.Api.Organizations;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using Xunit;

namespace FGP.Api.Tests;

public sealed class OrganizationIsolationTests
{
    [Fact]
    public async Task Membership_read_returns_not_found_for_another_organization_without_disclosure()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var firstClient = app.CreateClient();
        var secondClient = app.CreateClient();
        var firstMembershipId = await RegisterConfirmAndSignInAsync(
            firstClient,
            app,
            "first-owner@example.test",
            "First Owner",
            "First Organization");
        var secondMembershipId = await RegisterConfirmAndSignInAsync(
            secondClient,
            app,
            "second-owner@example.test",
            "Second Owner",
            "Second Organization");
        var missingMembershipId = Guid.NewGuid();

        var ownResponse = await firstClient.GetAsync($"/api/organizations/members/{firstMembershipId}");
        var foreignResponse = await firstClient.GetAsync($"/api/organizations/members/{secondMembershipId}");
        var missingResponse = await firstClient.GetAsync($"/api/organizations/members/{missingMembershipId}");

        Assert.Equal(HttpStatusCode.OK, ownResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, foreignResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, missingResponse.StatusCode);
        Assert.Equal(
            await missingResponse.Content.ReadAsStringAsync(),
            await foreignResponse.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Membership_write_returns_not_found_for_another_organization_without_mutating_it()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var firstClient = app.CreateClient();
        var secondClient = app.CreateClient();
        await RegisterConfirmAndSignInAsync(
            firstClient,
            app,
            "first-owner@example.test",
            "First Owner",
            "First Organization");
        var secondMembershipId = await RegisterConfirmAndSignInAsync(
            secondClient,
            app,
            "second-owner@example.test",
            "Second Owner",
            "Second Organization");
        var missingMembershipId = Guid.NewGuid();

        var foreignResponse = await firstClient.PatchAsJsonAsync(
            $"/api/organizations/members/{secondMembershipId}",
            new { role = "Treasurer" });
        var missingResponse = await firstClient.PatchAsJsonAsync(
            $"/api/organizations/members/{missingMembershipId}",
            new { role = "Treasurer" });

        Assert.Equal(HttpStatusCode.NotFound, foreignResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, missingResponse.StatusCode);
        Assert.Equal(
            await missingResponse.Content.ReadAsStringAsync(),
            await foreignResponse.Content.ReadAsStringAsync());

        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        var foreignMembership = await database.Memberships
            .AsNoTracking()
            .SingleAsync(candidate => candidate.Id == secondMembershipId);
        Assert.Equal(OrganizationRole.Owner, foreignMembership.Role);
        Assert.Equal(MembershipStatus.Active, foreignMembership.Status);
    }

    private static async Task<Guid> RegisterConfirmAndSignInAsync(
        HttpClient client,
        IdentityApiFactory app,
        string email,
        string displayName,
        string organizationName)
    {
        var registration = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "CorrectHorseBatteryStaple1!",
            displayName,
            organizationName,
        });
        Assert.Equal(HttpStatusCode.Created, registration.StatusCode);

        var confirmationUri = new Uri(app.EmailSender.Emails.Single(message =>
            message.Kind == "confirmation" && message.Email == email).Link);
        var query = QueryHelpers.ParseQuery(confirmationUri.Query);
        var verification = await client.PostAsJsonAsync("/api/auth/verify-email", new
        {
            userId = query["userId"].Single(),
            token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(query["token"].Single()!)),
        });
        Assert.Equal(HttpStatusCode.NoContent, verification.StatusCode);

        var signIn = await client.PostAsJsonAsync("/api/auth/sign-in", new
        {
            email,
            password = "CorrectHorseBatteryStaple1!",
        });
        Assert.Equal(HttpStatusCode.NoContent, signIn.StatusCode);

        var session = await client.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        return Assert.IsType<Guid>(session?.MembershipId);
    }
}
