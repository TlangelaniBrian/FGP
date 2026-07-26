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

public sealed class CheckInEndpointTests
{
    [Fact]
    public async Task Checkin_creation_requires_authentication()
    {
        await using var app = await IdentityApiFactory.CreateAsync();

        using var response = await app.CreateClient().PostAsJsonAsync("/api/projects/1/checkins", ValidRequest());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Create_checkin_preserves_fields_and_uses_the_claimed_organization()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        var actor = await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        await AddEarlierMembershipAsync(app, actor);
        var projectId = await SeedProjectAsync(app, actor, "Claimed project");

        using var response = await client.PostAsJsonAsync($"/api/projects/{projectId}/checkins", ValidRequest());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var payload = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(projectId, payload.RootElement.GetProperty("projectId").GetInt64());
        Assert.Equal("2026-02-09", payload.RootElement.GetProperty("weekOf").GetString());
        Assert.Equal("Transfer documents requested", payload.RootElement.GetProperty("attorneyStatus").GetString());
        Assert.True(payload.RootElement.GetProperty("savingsConfirmed").GetBoolean());
        Assert.Equal("4250.75", payload.RootElement.GetProperty("depositZar").GetString());
        Assert.Equal("Architect shortlist complete", payload.RootElement.GetProperty("supplierProgress").GetString());
        Assert.Equal("Awaiting title deed", payload.RootElement.GetProperty("openIssues").GetString());
        Assert.Equal("Follow up with attorney", payload.RootElement.GetProperty("actionsNextCall").GetString());
        Assert.Equal("Approve survey quote", payload.RootElement.GetProperty("decisionsNeeded").GetString());
        Assert.False(payload.RootElement.TryGetProperty("organizationId", out _));

        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        var checkin = await database.ProjectCheckins.SingleAsync();
        Assert.Equal(actor.OrganizationId, checkin.OrganizationId);
        Assert.Equal(4250.75m, checkin.DepositZar);
    }

    [Fact]
    public async Task Create_checkin_does_not_disclose_foreign_projects()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        var actor = await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        var otherOrganizationId = await AddEarlierMembershipAsync(app, actor);
        var foreignProjectId = await SeedProjectAsync(
            app,
            new ContractActor(actor.UserId, otherOrganizationId),
            "Foreign project");

        using var foreign = await client.PostAsJsonAsync($"/api/projects/{foreignProjectId}/checkins", ValidRequest());
        using var missing = await client.PostAsJsonAsync($"/api/projects/{foreignProjectId + 9999}/checkins", ValidRequest());

        Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal(await missing.Content.ReadAsStringAsync(), await foreign.Content.ReadAsStringAsync());

        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        Assert.Empty(await database.ProjectCheckins.ToListAsync());
    }

    [Fact]
    public async Task Create_checkin_rejects_invalid_week_and_out_of_range_fields()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        var actor = await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        var projectId = await SeedProjectAsync(app, actor, "Validated project");

        using var invalidWeek = await client.PostAsJsonAsync($"/api/projects/{projectId}/checkins", new
        {
            weekOf = "09-02-2026",
        });
        using var invalidDeposit = await client.PostAsJsonAsync($"/api/projects/{projectId}/checkins", new
        {
            weekOf = "2026-02-09",
            depositZar = 100_000_000.01m,
        });
        using var longIssue = await client.PostAsJsonAsync($"/api/projects/{projectId}/checkins", new
        {
            weekOf = "2026-02-09",
            openIssues = new string('x', 2001),
        });

        Assert.Equal(HttpStatusCode.UnprocessableEntity, invalidWeek.StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, invalidDeposit.StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, longIssue.StatusCode);
    }

    [Fact]
    public async Task Viewer_cannot_create_checkins()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        var actor = await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        var projectId = await SeedProjectAsync(app, actor, "Locked project");
        await SetRoleAsync(app, actor, OrganizationRole.Viewer);

        using var response = await client.PostAsJsonAsync($"/api/projects/{projectId}/checkins", ValidRequest());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private static object ValidRequest() => new
    {
        weekOf = "2026-02-09",
        attorneyStatus = "Transfer documents requested",
        savingsConfirmed = true,
        depositZar = 4250.75m,
        supplierProgress = "Architect shortlist complete",
        openIssues = "Awaiting title deed",
        actionsNextCall = "Follow up with attorney",
        decisionsNeeded = "Approve survey quote",
    };

    private static async Task<long> SeedProjectAsync(
        IdentityApiFactory app,
        ContractActor actor,
        string name)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        var project = new Project
        {
            OrganizationId = actor.OrganizationId,
            UserId = actor.UserId,
            Name = name,
            Status = "planning",
            Scenario = "base",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        database.Projects.Add(project);
        await database.SaveChangesAsync();
        return project.Id;
    }

    private static async Task<Guid> AddEarlierMembershipAsync(IdentityApiFactory app, ContractActor actor)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        var claimedMembership = await database.Memberships.SingleAsync(candidate =>
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
