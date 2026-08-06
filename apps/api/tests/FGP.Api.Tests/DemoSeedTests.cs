using FGP.Api.Data;
using FGP.Api.Data.Seed;
using FGP.Api.Identity;
using FGP.Api.Organizations;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace FGP.Api.Tests;

public sealed class DemoSeedTests
{
    private static readonly Guid DemoOrganizationId = Guid.Parse("11111111-2222-4333-8444-555555555555");

    private static async Task SeedTwiceAsync(IdentityApiFactory app)
    {
        await using (var scope = app.Services.CreateAsyncScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            await RoleUserSeeder.SeedAsync(database, userManager, DemoOrganizationId);
        }
        await using (var scope = app.Services.CreateAsyncScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            await RoleUserSeeder.SeedAsync(database, userManager, DemoOrganizationId);
        }
    }

    [Fact]
    public async Task Demo_seed_creates_one_confirmed_user_and_membership_per_role_and_is_idempotent()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        await SeedTwiceAsync(app);

        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();

        var organization = await database.Organizations.SingleAsync(item => item.Id == DemoOrganizationId);
        Assert.Equal("First Generation Properties (Demo)", organization.Name);

        var demoEmails = RoleUserSeeder.DemoUsers.Select(item => item.Email).ToArray();
        var users = await database.Users
            .Where(user => demoEmails.Contains(user.Email))
            .ToListAsync();
        Assert.Equal(5, users.Count);
        Assert.All(users, user => Assert.True(user.EmailConfirmed));

        var memberships = await database.Memberships
            .Where(item => item.OrganizationId == DemoOrganizationId)
            .ToListAsync();
        Assert.Equal(5, memberships.Count);
        Assert.All(memberships, membership => Assert.Equal(MembershipStatus.Active, membership.Status));
        Assert.Equal(
            Enum.GetValues<OrganizationRole>().ToHashSet(),
            memberships.Select(membership => membership.Role).ToHashSet());
        Assert.All(
            memberships,
            membership => Assert.Single(
                memberships.Where(candidate => candidate.UserId == membership.UserId)));
    }

    [Fact]
    public async Task Demo_seed_into_an_organization_with_an_existing_active_owner_skips_the_occupied_role()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        var registration = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email = "registered-owner@example.test",
            password = "CorrectHorseBatteryStaple1!",
            displayName = "Registered Owner",
            organizationName = "Registered Org",
        });
        Assert.Equal(HttpStatusCode.Created, registration.StatusCode);

        Guid registeredUserId;
        Guid organizationId;
        await using (var setupScope = app.Services.CreateAsyncScope())
        {
            var database = setupScope.ServiceProvider.GetRequiredService<FgpDbContext>();
            registeredUserId = (await database.Users.SingleAsync(item => item.Email == "registered-owner@example.test")).Id;
            organizationId = (await database.Memberships.SingleAsync(item => item.UserId == registeredUserId)).OrganizationId;
        }

        await using (var seedScope = app.Services.CreateAsyncScope())
        {
            var database = seedScope.ServiceProvider.GetRequiredService<FgpDbContext>();
            var userManager = seedScope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            await RoleUserSeeder.SeedAsync(database, userManager, organizationId);
        }

        await using (var verifyScope = app.Services.CreateAsyncScope())
        {
            var database = verifyScope.ServiceProvider.GetRequiredService<FgpDbContext>();
            var memberships = await database.Memberships
                .AsNoTracking()
                .Where(item => item.OrganizationId == organizationId && item.Status == MembershipStatus.Active)
                .ToListAsync();
            Assert.Equal(5, memberships.Count);
            Assert.Equal(1, memberships.Count(item => item.Role == OrganizationRole.Owner));
            Assert.Single(memberships, item => item.Role == OrganizationRole.Owner && item.UserId == registeredUserId);
            Assert.Equal(
                new[] { OrganizationRole.Chairperson, OrganizationRole.Treasurer, OrganizationRole.Analyst, OrganizationRole.Viewer },
                memberships.Where(item => item.Role != OrganizationRole.Owner).Select(item => item.Role).OrderBy(item => item).ToArray());
        }
    }

    [Theory]
    [InlineData("owner@fgp.demo", OrganizationRole.Owner)]
    [InlineData("chairperson@fgp.demo", OrganizationRole.Chairperson)]
    [InlineData("treasurer@fgp.demo", OrganizationRole.Treasurer)]
    [InlineData("analyst@fgp.demo", OrganizationRole.Analyst)]
    [InlineData("viewer@fgp.demo", OrganizationRole.Viewer)]
    public async Task Demo_users_sign_in_with_the_expected_role_capabilities(
        string email,
        OrganizationRole expectedRole)
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        await SeedTwiceAsync(app);

        using var client = app.CreateClient();
        var signIn = await client.PostAsJsonAsync("/api/auth/sign-in", new
        {
            email,
            password = RoleUserSeeder.DemoPassword,
        });
        Assert.Equal(HttpStatusCode.NoContent, signIn.StatusCode);

        var session = await client.GetFromJsonAsync<JsonElement>("/api/auth/session");
        Assert.Equal(expectedRole.ToString(), session.GetProperty("activeOrganization").GetProperty("role").GetString());
        var capabilities = session.GetProperty("capabilities")
            .EnumerateArray()
            .Select(item => item.GetString()!)
            .OrderBy(item => item)
            .ToArray();
        Assert.Equal(
            CapabilityPolicy.For(expectedRole).OrderBy(item => item).ToArray(),
            capabilities);
    }

    [Fact]
    public async Task Demo_users_cannot_sign_in_before_seeding()
    {
        await using var app = await IdentityApiFactory.CreateAsync();

        using var client = app.CreateClient();
        var signIn = await client.PostAsJsonAsync("/api/auth/sign-in", new
        {
            email = "owner@fgp.demo",
            password = RoleUserSeeder.DemoPassword,
        });
        Assert.Equal(HttpStatusCode.Unauthorized, signIn.StatusCode);
    }
}
