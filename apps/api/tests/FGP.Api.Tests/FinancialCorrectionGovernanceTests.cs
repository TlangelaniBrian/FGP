using FGP.Api.CapitalFund;
using FGP.Api.Data;
using FGP.Api.Identity;
using FGP.Api.Organizations;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;
using Xunit;

namespace FGP.Api.Tests;

public sealed class FinancialCorrectionGovernanceTests
{
    [Fact]
    public async Task Treasurer_proposed_correction_requires_a_distinct_owner_or_chairperson_and_applies_a_new_version()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var ownerClient = app.CreateClient();
        var owner = await ContractTestSession.RegisterConfirmAndSignInAsync(ownerClient, app);
        var chair = await AddMemberAsync(app, owner.OrganizationId, "chair@example.test", OrganizationRole.Chairperson);
        var treasurer = await AddMemberAsync(app, owner.OrganizationId, "treasurer@example.test", OrganizationRole.Treasurer);
        var analyst = await AddMemberAsync(app, owner.OrganizationId, "analyst@example.test", OrganizationRole.Analyst);

        var contributionResponse = await ownerClient.PostAsJsonAsync("/api/capital/contributions", new
        {
            memberId = analyst.Id,
            amount = 1000m,
            contributionDate = "2026-07-26",
        });
        Assert.Equal(HttpStatusCode.Created, contributionResponse.StatusCode);
        var contribution = await contributionResponse.Content.ReadFromJsonAsync<ContributionResponse>();
        Assert.NotNull(contribution);
        Assert.Equal("analyst", contribution!.MemberName);
        Assert.Equal(1000m, contribution.Amount);
        var contributionId = contribution.Id;

        var treasurerClient = await SignInMemberAsync(app, "treasurer@example.test");
        var proposalResponse = await treasurerClient.PostAsJsonAsync("/api/capital/corrections", new
        {
            contributionId,
            action = "edit",
            proposedAmount = 1250m,
        });
        Assert.Equal(HttpStatusCode.Created, proposalResponse.StatusCode);
        var proposal = await proposalResponse.Content.ReadFromJsonAsync<CorrectionResponse>();
        Assert.NotNull(proposal);
        Assert.Equal("edit", proposal!.Action);
        Assert.Equal(1250m, proposal.ProposedAmount);
        Assert.False(proposal.Approved);
        Assert.Equal(CapitalFundStatuses.Open, proposal.Status);
        Assert.Equal(2, proposal.Signatures.Count);
        var proposalId = proposal.Id;

        var capital = await ownerClient.GetFromJsonAsync<CapitalResponse>("/api/capital/");
        Assert.NotNull(capital);
        var listedCorrection = capital!.Corrections.Single(item => item.Id == proposalId);
        Assert.Empty(listedCorrection.Approvals);
        Assert.Equal(2, listedCorrection.Signatures.Count);

        var analystClient = await SignInMemberAsync(app, "analyst@example.test");
        Assert.Equal(HttpStatusCode.Forbidden, (await analystClient.PostAsync($"/api/capital/corrections/{proposalId}/approvals", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await treasurerClient.PostAsync($"/api/capital/corrections/{proposalId}/approvals", null)).StatusCode);

        var chairClient = await SignInMemberAsync(app, "chair@example.test");
        var approval = await chairClient.PostAsync($"/api/capital/corrections/{proposalId}/approvals", null);
        Assert.Equal(HttpStatusCode.OK, approval.StatusCode);
        var approved = await approval.Content.ReadFromJsonAsync<CorrectionResponse>();
        Assert.NotNull(approved);
        Assert.True(approved!.Approved);
        Assert.Equal(CapitalFundStatuses.Applied, approved.Status);
        Assert.Single(approved.Approvals);

        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        var versions = await database.CapitalContributions
            .Where(item => item.Id == contributionId || item.SupersedesContributionId == contributionId)
            .OrderBy(item => item.VersionNumber)
            .ToListAsync();
        Assert.Equal(2, versions.Count);
        Assert.False(versions[0].IsCurrent);
        Assert.Equal(1250m, versions[1].Amount);
        Assert.True(versions[1].IsCurrent);
        Assert.Equal(CapitalFundStatuses.Applied, await database.CapitalCorrectionProposals.Where(item => item.Id == proposalId).Select(item => item.Status).SingleAsync());
        var auditEvents = await database.GovernanceAuditEvents.ToListAsync();
        Assert.Contains(auditEvents, item => item.EventType == "contribution_recorded" && item.EntityId == contributionId);
        Assert.Contains(auditEvents, item => item.EventType == "correction_proposed" && item.EntityId == proposalId);
        Assert.Contains(auditEvents, item => item.EventType == "correction_approved" && item.EntityId == proposalId);
    }

    [Fact]
    public async Task Legacy_capital_actions_return_the_enriched_correction_contract()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var ownerClient = app.CreateClient();
        var owner = await ContractTestSession.RegisterConfirmAndSignInAsync(ownerClient, app);
        await AddMemberAsync(app, owner.OrganizationId, "chair@example.test", OrganizationRole.Chairperson);
        var treasurer = await AddMemberAsync(app, owner.OrganizationId, "treasurer@example.test", OrganizationRole.Treasurer);
        var analyst = await AddMemberAsync(app, owner.OrganizationId, "analyst@example.test", OrganizationRole.Analyst);

        var contributionResponse = await ownerClient.PostAsJsonAsync("/api/capital/contributions", new
        {
            memberId = analyst.Id,
            amount = 1000m,
            contributionDate = "2026-07-26",
        });
        var contributionId = (await contributionResponse.Content.ReadFromJsonAsync<IdResponse>())!.Id;

        var treasurerClient = await SignInMemberAsync(app, "treasurer@example.test");
        var proposalResponse = await treasurerClient.PostAsJsonAsync("/api/capital", new
        {
            action = "correction",
            contributionId,
            correctionAction = "edit",
            amount = 1250m,
            proposedNote = "legacy probe",
        });
        Assert.Equal(HttpStatusCode.Created, proposalResponse.StatusCode);
        var proposal = await proposalResponse.Content.ReadFromJsonAsync<CorrectionResponse>();
        Assert.NotNull(proposal);
        Assert.Equal(1250m, proposal!.ProposedAmount);
        Assert.Equal("legacy probe", proposal.ProposedNote);
        Assert.Empty(proposal.Approvals);
        Assert.Equal(2, proposal.Signatures.Count);

        var chairClient = await SignInMemberAsync(app, "chair@example.test");
        var approval = await chairClient.PostAsJsonAsync("/api/capital", new
        {
            action = "approve-correction",
            proposalId = proposal.Id,
        });
        Assert.Equal(HttpStatusCode.OK, approval.StatusCode);
        var approved = await approval.Content.ReadFromJsonAsync<CorrectionResponse>();
        Assert.NotNull(approved);
        Assert.True(approved!.Approved);
        Assert.Equal(CapitalFundStatuses.Applied, approved.Status);
        Assert.Equal(1250m, approved.ProposedAmount);
        Assert.Equal("legacy probe", approved.ProposedNote);
        Assert.Single(approved.Approvals);
        Assert.Equal(2, approved.Signatures.Count);
    }

    [Fact]
    public async Task Owner_subject_cannot_approve_own_subject_correction_but_chairperson_can()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var ownerClient = app.CreateClient();
        var owner = await ContractTestSession.RegisterConfirmAndSignInAsync(ownerClient, app);
        var chair = await AddMemberAsync(app, owner.OrganizationId, "chair@example.test", OrganizationRole.Chairperson);
        var treasurer = await AddMemberAsync(app, owner.OrganizationId, "treasurer@example.test", OrganizationRole.Treasurer);

        var contributionResponse = await ownerClient.PostAsJsonAsync("/api/capital/contributions", new
        {
            memberId = await GetMembershipIdAsync(app, "owner@example.test"),
            amount = 1000m,
            contributionDate = "2026-07-26",
        });
        var contributionId = (await contributionResponse.Content.ReadFromJsonAsync<IdResponse>())!.Id;
        var treasurerClient = await SignInMemberAsync(app, "treasurer@example.test");
        var proposalResponse = await treasurerClient.PostAsJsonAsync("/api/capital/corrections", new
        {
            contributionId,
            action = "remove",
        });
        var proposalId = (await proposalResponse.Content.ReadFromJsonAsync<IdResponse>())!.Id;

        var ownerApproval = await ownerClient.PostAsync($"/api/capital/corrections/{proposalId}/approvals", null);
        Assert.Equal(HttpStatusCode.Forbidden, ownerApproval.StatusCode);
        var chairClient = await SignInMemberAsync(app, "chair@example.test");
        Assert.Equal(HttpStatusCode.OK, (await chairClient.PostAsync($"/api/capital/corrections/{proposalId}/approvals", null)).StatusCode);
    }

    [Fact]
    public async Task Correction_proposal_returns_conflict_when_no_distinct_governor_can_approve()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var ownerClient = app.CreateClient();
        var owner = await ContractTestSession.RegisterConfirmAndSignInAsync(ownerClient, app);
        var chair = await AddMemberAsync(app, owner.OrganizationId, "chair@example.test", OrganizationRole.Chairperson);
        var contributionResponse = await ownerClient.PostAsJsonAsync("/api/capital/contributions", new
        {
            memberId = await GetMembershipIdAsync(app, "owner@example.test"),
            amount = 1000m,
            contributionDate = "2026-07-26",
        });
        var contributionId = (await contributionResponse.Content.ReadFromJsonAsync<IdResponse>())!.Id;

        var chairClient = await SignInMemberAsync(app, "chair@example.test");
        var response = await chairClient.PostAsJsonAsync("/api/capital/corrections", new
        {
            contributionId,
            action = "edit",
            proposedAmount = 1100m,
        });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("NoEligibleApprover", (await response.Content.ReadFromJsonAsync<ApiError>())!.Code);
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

    private static async Task<Guid> GetMembershipIdAsync(IdentityApiFactory app, string email)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        return await database.Memberships.Join(database.Users, membership => membership.UserId, user => user.Id, (membership, user) => new { membership, user.Email }).Where(item => item.Email == email).Select(item => item.membership.Id).SingleAsync();
    }

    private sealed record IdResponse(long Id);

    private sealed record ContributionResponse(
        long Id,
        string MemberName,
        DateOnly ContributionDate,
        decimal Amount,
        string? Note);

    private sealed record CorrectionResponse(
        long Id,
        long ContributionId,
        string Action,
        IReadOnlyList<Guid> Approvals,
        Guid ProposedBy,
        Guid ProposedByMemberId,
        decimal? ProposedAmount,
        string? ProposedNote,
        bool Approved,
        string Status,
        IReadOnlyList<SignatureResponse> Signatures);

    private sealed record SignatureResponse(Guid MemberId, string Name, string Role, bool Signed);

    private sealed record CapitalResponse(IReadOnlyList<CorrectionResponse> Corrections);
}
