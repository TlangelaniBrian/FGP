using FGP.Api.CapitalFund;
using FGP.Api.Data;
using FGP.Api.Data.Seed;
using FGP.Api.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace FGP.Api.Tests;

/// <summary>
/// Guards the property the demo seed exists to provide: after seeding, the portal has
/// something to show. The seed previously created only reference and spatial data, so a
/// freshly seeded database rendered an empty Dashboard, Projects and Scout.
/// </summary>
public sealed class DemoPortalSeedTests
{
    private static readonly Guid DemoOrganizationId = Guid.Parse("11111111-3333-4333-8444-666666666666");

    private static async Task SeedAsync(IdentityApiFactory app)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        await RoleUserSeeder.SeedAsync(database, userManager, DemoOrganizationId);
        await DemoPortalDataSeeder.SeedAsync(database, DemoOrganizationId);
    }

    [Fact]
    public async Task Demo_portal_seed_populates_every_headline_screen()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        await SeedAsync(app);

        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();

        var listings = await database.Listings
            .Where(item => item.OrganizationId == DemoOrganizationId)
            .ToListAsync();
        Assert.Equal(5, listings.Count);
        // Scout plots leads from listing coordinates; without them the map is empty.
        Assert.All(listings, listing => Assert.NotNull(listing.Coordinates));
        Assert.All(listings, listing => Assert.NotNull(listing.FeasibilityScore));

        var projects = await database.Projects
            .Where(item => item.OrganizationId == DemoOrganizationId)
            .ToListAsync();
        Assert.Equal(3, projects.Count);
        Assert.Equal(
            new[] { "Karenpark", "Noordwyk", "Soshanguve Build" },
            projects.Select(project => project.Name).OrderBy(name => name, StringComparer.Ordinal));

        var projectIds = projects.Select(project => project.Id).ToList();
        Assert.NotEmpty(await database.Milestones.Where(item => projectIds.Contains(item.ProjectId)).ToListAsync());
        Assert.NotEmpty(await database.ProjectBudgetItems.Where(item => projectIds.Contains(item.ProjectId)).ToListAsync());
        Assert.NotEmpty(await database.ProjectContacts.Where(item => projectIds.Contains(item.ProjectId)).ToListAsync());
        Assert.NotEmpty(await database.ProjectDecisions.Where(item => projectIds.Contains(item.ProjectId)).ToListAsync());

        // Every project is backed by a report, so the pipeline reads end to end.
        Assert.All(projects, project => Assert.NotNull(project.ReportId));

        var contributions = await database.CapitalContributions
            .Where(item => item.OrganizationId == DemoOrganizationId && item.IsCurrent)
            .ToListAsync();
        Assert.NotEmpty(contributions);
        Assert.All(contributions, contribution => Assert.Equal(CapitalFundStatuses.Posted, contribution.Status));
        // The Viewer must not appear in the ledger: it is outside the governing set.
        Assert.Equal(4, contributions.Select(contribution => contribution.MemberId).Distinct().Count());
    }

    [Fact]
    public async Task Demo_portal_seed_is_idempotent()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        await SeedAsync(app);
        await SeedAsync(app);

        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();

        Assert.Equal(5, await database.Listings.CountAsync(item => item.OrganizationId == DemoOrganizationId));
        Assert.Equal(3, await database.Projects.CountAsync(item => item.OrganizationId == DemoOrganizationId));
        Assert.Equal(12, await database.CapitalContributions.CountAsync(item => item.OrganizationId == DemoOrganizationId));
    }
}
