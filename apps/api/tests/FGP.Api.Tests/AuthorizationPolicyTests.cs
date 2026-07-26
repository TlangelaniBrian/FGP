using FGP.Api.Identity;
using FGP.Api.Organizations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using System.Net.Http.Json;
using System.Security.Claims;
using Xunit;

namespace FGP.Api.Tests;

public sealed class AuthorizationPolicyTests
{
    [Theory]
    [InlineData(OrganizationRole.Owner, Capabilities.CoSignFinancial, true)]
    [InlineData(OrganizationRole.Chairperson, Capabilities.CoSignFinancial, true)]
    [InlineData(OrganizationRole.Treasurer, Capabilities.CoSignFinancial, false)]
    [InlineData(OrganizationRole.Analyst, Capabilities.CoSignFinancial, false)]
    [InlineData(OrganizationRole.Viewer, Capabilities.RecordContribution, false)]
    [InlineData(OrganizationRole.Chairperson, Capabilities.ProposeFundGoal, true)]
    public void Capability_policy_is_role_scoped(OrganizationRole role, string capability, bool expected)
    {
        Assert.Equal(expected, CapabilityPolicy.Allows(role, capability));
    }

    [Fact]
    public async Task Capability_authorization_uses_the_current_server_membership()
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

        using var scope = app.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<FGP.Api.Data.FgpDbContext>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var authorization = scope.ServiceProvider.GetRequiredService<IAuthorizationService>();
        var owner = await users.FindByEmailAsync("owner@example.test");
        var ownerMembership = database.Memberships.Single(membership => membership.UserId == owner!.Id);
        var treasurer = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = "treasurer@example.test",
            Email = "treasurer@example.test",
            EmailConfirmed = true,
            DisplayName = "Treasurer Example",
        };
        Assert.True((await users.CreateAsync(treasurer, "CorrectHorseBatteryStaple1!")).Succeeded);
        database.Memberships.Add(new Membership
        {
            Id = Guid.NewGuid(),
            OrganizationId = ownerMembership.OrganizationId,
            UserId = treasurer.Id,
            Role = OrganizationRole.Treasurer,
            Status = MembershipStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
            ActivatedAt = DateTimeOffset.UtcNow,
        });
        await database.SaveChangesAsync();

        var ownerResult = await authorization.AuthorizeAsync(
            PrincipalFor(owner!.Id, ownerMembership.OrganizationId),
            null,
            Capabilities.CoSignFinancial);
        var treasurerResult = await authorization.AuthorizeAsync(
            PrincipalFor(treasurer.Id, ownerMembership.OrganizationId),
            null,
            Capabilities.CoSignFinancial);

        Assert.True(ownerResult.Succeeded);
        Assert.False(treasurerResult.Succeeded);
    }

    [Fact]
    public async Task Capability_authorization_uses_the_authenticated_organization_membership()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await client.PostAsJsonAsync("/api/auth/register", new
        {
            email = "member@example.test",
            password = "CorrectHorseBatteryStaple1!",
            displayName = "Member Example",
            organizationName = "First Organization",
        });

        using var scope = app.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<FGP.Api.Data.FgpDbContext>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var authorization = scope.ServiceProvider.GetRequiredService<IAuthorizationService>();
        var member = await users.FindByEmailAsync("member@example.test");
        var ownerMembership = database.Memberships.Single(candidate => candidate.UserId == member!.Id);
        var secondOrganization = new Organization
        {
            Id = Guid.NewGuid(),
            Name = "Second Organization",
            CreatedAt = DateTimeOffset.UtcNow,
        };
        database.Organizations.Add(secondOrganization);
        database.Memberships.Add(new Membership
        {
            Id = Guid.NewGuid(),
            OrganizationId = secondOrganization.Id,
            UserId = member!.Id,
            Role = OrganizationRole.Treasurer,
            Status = MembershipStatus.Active,
            CreatedAt = ownerMembership.CreatedAt.AddMinutes(1),
            ActivatedAt = ownerMembership.ActivatedAt?.AddMinutes(1),
        });
        await database.SaveChangesAsync();

        var firstOrganization = await authorization.AuthorizeAsync(
            PrincipalFor(member.Id, ownerMembership.OrganizationId),
            null,
            Capabilities.CoSignFinancial);
        var secondOrganizationResult = await authorization.AuthorizeAsync(
            PrincipalFor(member.Id, secondOrganization.Id),
            null,
            Capabilities.CoSignFinancial);

        Assert.True(firstOrganization.Succeeded);
        Assert.False(secondOrganizationResult.Succeeded);
    }

    private static ClaimsPrincipal PrincipalFor(Guid userId, Guid organizationId) =>
        new(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim("organization_id", organizationId.ToString()),
        ], "test"));
}
