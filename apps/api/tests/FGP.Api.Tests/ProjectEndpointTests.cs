using FGP.Api.Data;
using FGP.Api.Data.Entities;
using FGP.Api.Identity;
using FGP.Api.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace FGP.Api.Tests;

public sealed class ProjectEndpointTests
{
    [Fact]
    public async Task Project_routes_require_authentication()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();

        using var list = await client.GetAsync("/api/projects");
        using var detail = await client.GetAsync("/api/projects/1");
        using var create = await client.PostAsJsonAsync("/api/projects", new
        {
            listingId = 1,
            reportId = 1,
            name = "Unauthenticated project",
        });
        using var update = await client.PatchAsJsonAsync("/api/projects/1", new
        {
            name = "Unauthenticated update",
        });

        Assert.Equal(HttpStatusCode.Unauthorized, list.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, detail.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, create.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, update.StatusCode);
    }

    [Fact]
    public async Task List_projects_preserves_the_bare_array_contract_and_uses_the_claimed_organization()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        var actor = await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        await SeedProjectAsync(app, actor, "Claimed project", createdAt: new DateTimeOffset(2026, 1, 2, 0, 0, 0, TimeSpan.Zero));
        var otherOrganizationId = await AddEarlierMembershipAsync(app, actor);
        await SeedProjectAsync(
            app,
            new ContractActor(actor.UserId, otherOrganizationId),
            "Foreign project",
            createdAt: new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero));

        using var response = await client.GetAsync("/api/projects");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var payload = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var project = Assert.Single(payload.RootElement.EnumerateArray());
        Assert.Equal("Claimed project", project.GetProperty("name").GetString());
        Assert.Equal(actor.UserId, project.GetProperty("userId").GetGuid());
        Assert.Equal("125000.5", project.GetProperty("phase1TargetZar").GetString());
        Assert.Equal("3500.25", project.GetProperty("monthlySavingZar").GetString());
        Assert.False(project.TryGetProperty("organizationId", out _));
    }

    [Fact]
    public async Task List_projects_clamps_limit_and_offset_and_returns_the_paginated_envelope()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        var actor = await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        await SeedProjectAsync(app, actor, "First", createdAt: new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero));
        await SeedProjectAsync(app, actor, "Second", createdAt: new DateTimeOffset(2026, 1, 2, 0, 0, 0, TimeSpan.Zero));
        await SeedProjectAsync(app, actor, "Third", createdAt: new DateTimeOffset(2026, 1, 3, 0, 0, 0, TimeSpan.Zero));

        using var minimumResponse = await client.GetAsync("/api/projects?limit=0&offset=-4");
        using var maximumResponse = await client.GetAsync("/api/projects?limit=999&offset=1");

        Assert.Equal(HttpStatusCode.OK, minimumResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, maximumResponse.StatusCode);
        using var minimumPayload = JsonDocument.Parse(await minimumResponse.Content.ReadAsStringAsync());
        using var maximumPayload = JsonDocument.Parse(await maximumResponse.Content.ReadAsStringAsync());
        Assert.Equal(1, minimumPayload.RootElement.GetProperty("limit").GetInt32());
        Assert.Equal(0, minimumPayload.RootElement.GetProperty("offset").GetInt32());
        Assert.Equal(3, minimumPayload.RootElement.GetProperty("total").GetInt32());
        Assert.Equal("Third", Assert.Single(minimumPayload.RootElement.GetProperty("projects").EnumerateArray()).GetProperty("name").GetString());

        Assert.Equal(200, maximumPayload.RootElement.GetProperty("limit").GetInt32());
        Assert.Equal(1, maximumPayload.RootElement.GetProperty("offset").GetInt32());
        Assert.Equal(3, maximumPayload.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(2, maximumPayload.RootElement.GetProperty("projects").GetArrayLength());
    }

    [Fact]
    public async Task Get_project_returns_the_complete_legacy_detail_shape()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        var actor = await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        var projectId = await SeedProjectAsync(app, actor, "Detailed project", includeDetails: true);

        using var response = await client.GetAsync($"/api/projects/{projectId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var payload = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("Detailed project", payload.RootElement.GetProperty("project").GetProperty("name").GetString());
        Assert.Equal("Earthworks", Assert.Single(payload.RootElement.GetProperty("budget").EnumerateArray()).GetProperty("item").GetString());
        Assert.Equal("Architect", Assert.Single(payload.RootElement.GetProperty("contacts").EnumerateArray()).GetProperty("role").GetString());
        Assert.Equal("Approve concept", Assert.Single(payload.RootElement.GetProperty("decisions").EnumerateArray()).GetProperty("decision").GetString());
        Assert.Equal("Submit plans", Assert.Single(payload.RootElement.GetProperty("milestones").EnumerateArray()).GetProperty("milestone").GetString());
        Assert.Equal("2026-01-12", payload.RootElement.GetProperty("latestCheckin").GetProperty("weekOf").GetString());
        Assert.Equal(3750.75m, payload.RootElement.GetProperty("savedToDate").GetDecimal());
    }

    [Fact]
    public async Task Get_project_does_not_disclose_whether_a_missing_id_belongs_to_another_organization()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        var actor = await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        var otherOrganizationId = await AddEarlierMembershipAsync(app, actor);
        var foreignProjectId = await SeedProjectAsync(
            app,
            new ContractActor(actor.UserId, otherOrganizationId),
            "Foreign project");

        using var foreign = await client.GetAsync($"/api/projects/{foreignProjectId}");
        using var missing = await client.GetAsync($"/api/projects/{foreignProjectId + 9999}");

        Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal(await missing.Content.ReadAsStringAsync(), await foreign.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Create_project_uses_claimed_organization_dependencies_and_preserves_response_fields()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        var actor = await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        await AddEarlierMembershipAsync(app, actor);
        var (listingId, reportId) = await SeedFeasibilityDependenciesAsync(app, actor);

        using var response = await client.PostAsJsonAsync("/api/projects", new
        {
            listingId,
            reportId,
            name = "New development",
            status = "planning",
            notes = "Initial scope",
            phase1TargetZar = 250000.75m,
            monthlySavingZar = 5000.5m,
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var payload = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("New development", payload.RootElement.GetProperty("name").GetString());
        Assert.Equal("250000.75", payload.RootElement.GetProperty("phase1TargetZar").GetString());
        Assert.Equal("5000.5", payload.RootElement.GetProperty("monthlySavingZar").GetString());

        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        var project = await database.Projects.SingleAsync(candidate => candidate.Name == "New development");
        Assert.Equal(actor.OrganizationId, project.OrganizationId);
        Assert.Contains(
            await database.ActivityEvents.ToListAsync(),
            activity => activity.OrganizationId == actor.OrganizationId &&
                        activity.EventType == "project_created" &&
                        activity.EntityId == project.Id.ToString());
    }

    [Fact]
    public async Task Viewer_cannot_create_or_update_projects()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        var actor = await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        var projectId = await SeedProjectAsync(app, actor, "Locked project");
        var (listingId, reportId) = await SeedFeasibilityDependenciesAsync(app, actor);
        await SetRoleAsync(app, actor, OrganizationRole.Viewer);

        using var create = await client.PostAsJsonAsync("/api/projects", new
        {
            listingId,
            reportId,
            name = "Forbidden project",
        });
        using var update = await client.PatchAsJsonAsync($"/api/projects/{projectId}", new
        {
            name = "Forbidden update",
        });

        Assert.Equal(HttpStatusCode.Forbidden, create.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, update.StatusCode);
    }

    [Fact]
    public async Task Update_project_is_organization_scoped_and_returns_not_found_for_foreign_projects()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        var actor = await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        var claimedProjectId = await SeedProjectAsync(app, actor, "Claimed project");
        var otherOrganizationId = await AddEarlierMembershipAsync(app, actor);
        var foreignProjectId = await SeedProjectAsync(
            app,
            new ContractActor(actor.UserId, otherOrganizationId),
            "Foreign project");

        using var updated = await client.PatchAsJsonAsync($"/api/projects/{claimedProjectId}", new
        {
            name = "Updated project",
            status = "construction",
            monthlySavingZar = 7000.25m,
        });
        using var foreign = await client.PatchAsJsonAsync($"/api/projects/{foreignProjectId}", new
        {
            name = "Disclosed project",
        });
        using var missing = await client.PatchAsJsonAsync($"/api/projects/{foreignProjectId + 9999}", new
        {
            name = "Missing project",
        });

        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        using var updatedPayload = JsonDocument.Parse(await updated.Content.ReadAsStringAsync());
        Assert.Equal("Updated project", updatedPayload.RootElement.GetProperty("name").GetString());
        Assert.Equal("construction", updatedPayload.RootElement.GetProperty("status").GetString());
        Assert.Equal("7000.25", updatedPayload.RootElement.GetProperty("monthlySavingZar").GetString());
        Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal(await missing.Content.ReadAsStringAsync(), await foreign.Content.ReadAsStringAsync());

        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        Assert.Equal("Foreign project", (await database.Projects.SingleAsync(candidate => candidate.Id == foreignProjectId)).Name);
    }

    private static async Task<long> SeedProjectAsync(
        IdentityApiFactory app,
        ContractActor actor,
        string name,
        DateTimeOffset? createdAt = null,
        bool includeDetails = false)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        var project = new Project
        {
            OrganizationId = actor.OrganizationId,
            UserId = actor.UserId,
            Name = name,
            Status = "planning",
            Notes = "Seeded project",
            ErfNumber = "ERF 42",
            Township = "Noordwyk",
            Partners = ["Partner A", "Partner B"],
            MonthlySavingZar = 3500.25m,
            Phase1TargetZar = 125000.5m,
            Scenario = "base",
            CreatedAt = createdAt ?? DateTimeOffset.UtcNow,
            UpdatedAt = createdAt ?? DateTimeOffset.UtcNow,
        };
        database.Projects.Add(project);
        await database.SaveChangesAsync();

        if (includeDetails)
        {
            database.ProjectBudgetItems.Add(new ProjectBudgetItem
            {
                OrganizationId = actor.OrganizationId,
                ProjectId = project.Id,
                Category = "Site works",
                Item = "Earthworks",
                Quantity = 2.5m,
                UnitCost = 1000.25m,
                TotalCost = 2500.625m,
                Status = "quoted",
                CreatedAt = DateTimeOffset.UtcNow,
            });
            database.ProjectContacts.Add(new ProjectContact
            {
                OrganizationId = actor.OrganizationId,
                ProjectId = project.Id,
                Role = "Architect",
                Name = "A. Example",
                Status = "active",
            });
            database.ProjectDecisions.Add(new ProjectDecision
            {
                OrganizationId = actor.OrganizationId,
                ProjectId = project.Id,
                DecidedAt = new DateOnly(2026, 1, 10),
                Decision = "Approve concept",
                CreatedAt = DateTimeOffset.UtcNow,
            });
            database.Milestones.Add(new Milestone
            {
                OrganizationId = actor.OrganizationId,
                ProjectId = project.Id,
                TargetDate = "31 Mar 2026",
                Name = "Submit plans",
                Status = "PENDING",
                CreatedAt = DateTimeOffset.UtcNow,
            });
            database.ProjectCheckins.AddRange(
                new ProjectCheckin
                {
                    OrganizationId = actor.OrganizationId,
                    ProjectId = project.Id,
                    WeekOf = new DateOnly(2026, 1, 5),
                    DepositZar = 1250.25m,
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-7),
                },
                new ProjectCheckin
                {
                    OrganizationId = actor.OrganizationId,
                    ProjectId = project.Id,
                    WeekOf = new DateOnly(2026, 1, 12),
                    DepositZar = 2500.5m,
                    CreatedAt = DateTimeOffset.UtcNow,
                });
            await database.SaveChangesAsync();
        }

        return project.Id;
    }

    private static async Task<(long ListingId, long ReportId)> SeedFeasibilityDependenciesAsync(
        IdentityApiFactory app,
        ContractActor actor)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        var now = DateTimeOffset.UtcNow;
        var listing = new Listing
        {
            OrganizationId = actor.OrganizationId,
            Source = "manual",
            CreatedAt = now,
            UpdatedAt = now,
        };
        database.Listings.Add(listing);
        await database.SaveChangesAsync();

        var report = new FeasibilityReport
        {
            OrganizationId = actor.OrganizationId,
            ListingId = listing.Id,
            UserId = actor.UserId,
            UnitType = "bachelor",
            TargetUnits = 4,
            ActualUnits = 4,
            CreatedAt = now,
        };
        database.FeasibilityReports.Add(report);
        await database.SaveChangesAsync();
        return (listing.Id, report.Id);
    }

    private static async Task<Guid> AddEarlierMembershipAsync(IdentityApiFactory app, ContractActor actor)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        var claimedMembership = await database.Memberships
            .SingleAsync(candidate =>
                candidate.UserId == actor.UserId &&
                candidate.OrganizationId == actor.OrganizationId);
        var otherOrganization = new Organization
        {
            Id = Guid.NewGuid(),
            Name = "Earlier organization",
            CreatedAt = claimedMembership.CreatedAt.AddDays(-1),
        };
        database.Organizations.Add(otherOrganization);
        database.Memberships.Add(new Membership
        {
            Id = Guid.NewGuid(),
            OrganizationId = otherOrganization.Id,
            UserId = actor.UserId,
            Role = OrganizationRole.Owner,
            Status = MembershipStatus.Active,
            CreatedAt = claimedMembership.CreatedAt.AddMinutes(-1),
            ActivatedAt = claimedMembership.ActivatedAt?.AddMinutes(-1),
        });
        await database.SaveChangesAsync();
        return otherOrganization.Id;
    }

    private static async Task SetRoleAsync(
        IdentityApiFactory app,
        ContractActor actor,
        OrganizationRole role)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        var membership = await database.Memberships.SingleAsync(candidate =>
            candidate.UserId == actor.UserId &&
            candidate.OrganizationId == actor.OrganizationId);
        membership.Role = role;
        await database.SaveChangesAsync();
    }
}
