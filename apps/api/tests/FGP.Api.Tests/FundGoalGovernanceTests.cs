using FGP.Api.CapitalFund;
using FGP.Api.Data;
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

public sealed class FundGoalGovernanceTests
{
    [Fact]
    public async Task Fund_goal_applies_only_after_every_submission_electorate_member_approves()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var ownerClient = app.CreateClient();
        var owner = await ContractTestSession.RegisterConfirmAndSignInAsync(ownerClient, app);
        var chair = await AddMemberAsync(app, owner.OrganizationId, "chair@example.test", OrganizationRole.Chairperson);
        var treasurer = await AddMemberAsync(app, owner.OrganizationId, "treasurer@example.test", OrganizationRole.Treasurer);
        var analyst = await AddMemberAsync(app, owner.OrganizationId, "analyst@example.test", OrganizationRole.Analyst);

        var proposalResponse = await ownerClient.PostAsJsonAsync("/api/capital/goals", new { newAmount = 900000m });
        Assert.Equal(HttpStatusCode.Created, proposalResponse.StatusCode);
        var proposal = await proposalResponse.Content.ReadFromJsonAsync<GoalResponse>();
        Assert.NotNull(proposal);
        Assert.Equal(CapitalFundStatuses.Open, proposal!.Status);
        Assert.Single(proposal.Approvals);
        Assert.Equal(4, proposal.Signatures.Count);
        Assert.Contains(proposal.Signatures, signature => signature.Signed);
        Assert.All(proposal.Signatures, signature => Assert.False(string.IsNullOrWhiteSpace(signature.Name)));
        var proposalId = proposal.Id;

        foreach (var (email, expectedStatus) in new[]
        {
            ("chair@example.test", CapitalFundStatuses.Open),
            ("treasurer@example.test", CapitalFundStatuses.Open),
            ("analyst@example.test", CapitalFundStatuses.Applied),
        })
        {
            var client = await SignInMemberAsync(app, email);
            var response = await client.PostAsync($"/api/capital/goals/{proposalId}/approvals", null);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(expectedStatus, (await response.Content.ReadFromJsonAsync<GoalResponse>())!.Status);
        }

        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        Assert.Equal(4, await database.CapitalGoalApprovals.CountAsync(item => item.ProposalId == proposalId));
        Assert.Equal(900000m, await database.OrganizationSettings.Where(item => item.OrganizationId == owner.OrganizationId && item.Key == "capital_goal").Select(item => item.Value.RootElement.GetDecimal()).SingleAsync());
        Assert.Contains(await database.GovernanceAuditEvents.ToListAsync(), item => item.EventType == "fund_goal_applied");

        var capital = await ownerClient.GetFromJsonAsync<CapitalResponse>("/api/capital/");
        Assert.NotNull(capital);
        Assert.Equal(4, capital!.Governance.Members.Count);
        Assert.Equal(4, capital.Governance.RequiredMembers.Count);
    }

    [Fact]
    public async Task Membership_change_voids_open_goal_and_preserves_approval_rows_with_linked_audit()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var ownerClient = app.CreateClient();
        var owner = await ContractTestSession.RegisterConfirmAndSignInAsync(ownerClient, app);
        var chair = await AddMemberAsync(app, owner.OrganizationId, "chair@example.test", OrganizationRole.Chairperson);
        var proposalResponse = await ownerClient.PostAsJsonAsync("/api/capital/goals", new { newAmount = 900000m });
        var proposal = await proposalResponse.Content.ReadFromJsonAsync<GoalResponse>();
        Assert.NotNull(proposal);
        var proposalId = proposal!.Id;

        var change = await ownerClient.PatchAsJsonAsync($"/api/organizations/members/{chair.Id}", new { status = "Removed" });
        Assert.Equal(HttpStatusCode.OK, change.StatusCode);

        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        Assert.Equal(CapitalFundStatuses.Voided, await database.CapitalGoalProposals.Where(item => item.Id == proposalId).Select(item => item.Status).SingleAsync());
        Assert.Single(await database.CapitalGoalApprovals.Where(item => item.ProposalId == proposalId).ToListAsync());
        Assert.Contains(await database.GovernanceAuditEvents.ToListAsync(), item => item.EventType == "fund_goal_voided_membership_change" && item.MembershipEventId != null);
    }

    [Fact]
    public async Task Withdrawal_leaves_goal_approvals_untouched_and_does_not_apply_goal()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var ownerClient = app.CreateClient();
        var owner = await ContractTestSession.RegisterConfirmAndSignInAsync(ownerClient, app);
        await AddMemberAsync(app, owner.OrganizationId, "chair@example.test", OrganizationRole.Chairperson);
        var proposalResponse = await ownerClient.PostAsJsonAsync("/api/capital/goals", new { newAmount = 900000m });
        var proposal = await proposalResponse.Content.ReadFromJsonAsync<GoalResponse>();
        Assert.NotNull(proposal);
        var proposalId = proposal!.Id;

        var withdrawal = await ownerClient.PostAsync($"/api/capital/goals/{proposalId}/withdraw", null);
        Assert.Equal(HttpStatusCode.NoContent, withdrawal.StatusCode);

        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        Assert.Equal(CapitalFundStatuses.Withdrawn, await database.CapitalGoalProposals.Where(item => item.Id == proposalId).Select(item => item.Status).SingleAsync());
        Assert.Single(await database.CapitalGoalApprovals.Where(item => item.ProposalId == proposalId).ToListAsync());
        Assert.False(await database.OrganizationSettings.AnyAsync(item => item.OrganizationId == owner.OrganizationId && item.Key == "capital_goal"));
    }

    private static async Task<Membership> AddMemberAsync(IdentityApiFactory app, Guid organizationId, string email, OrganizationRole role)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        var user = new ApplicationUser { Id = Guid.NewGuid(), UserName = email, Email = email, EmailConfirmed = true, DisplayName = email.Split('@')[0] };
        Assert.True((await users.CreateAsync(user, "CorrectHorseBatteryStaple1!")).Succeeded);
        var membership = new Membership
        {
            Id = Guid.NewGuid(), OrganizationId = organizationId, UserId = user.Id, Role = role,
            Status = MembershipStatus.Active, CreatedAt = DateTimeOffset.UtcNow, ActivatedAt = DateTimeOffset.UtcNow,
        };
        database.Memberships.Add(membership);
        await database.SaveChangesAsync();
        return membership;
    }

    private static async Task<HttpClient> SignInMemberAsync(IdentityApiFactory app, string email)
    {
        var client = app.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/sign-in", new { email, password = "CorrectHorseBatteryStaple1!" });
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        return client;
    }

    private sealed record GoalResponse(
        long Id,
        string Status,
        decimal NewAmount,
        IReadOnlyList<Guid> Approvals,
        Guid ProposedBy,
        IReadOnlyList<SignatureResponse> Signatures);

    private sealed record SignatureResponse(Guid MemberId, string Name, string Role, bool Signed);

    private sealed record CapitalResponse(GovernanceResponse Governance);

    private sealed record GovernanceResponse(
        IReadOnlyList<JsonElement> Members,
        IReadOnlyList<JsonElement> RequiredMembers);
}
