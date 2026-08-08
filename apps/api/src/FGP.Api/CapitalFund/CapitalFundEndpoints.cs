using FGP.Api.Data;
using FGP.Api.Identity;
using FGP.Api.Organizations;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace FGP.Api.CapitalFund;

public static class CapitalFundEndpoints
{
    public static void MapCapitalFundEndpoints(this WebApplication app)
    {
        var capital = app.MapGroup("/api/capital").RequireAuthorization();
        capital.MapGet("/", GetCapitalAsync);
        capital.MapPost("", LegacyCapitalActionAsync);
        capital.MapPost("/contributions", RecordContributionAsync).RequireAuthorization(Capabilities.RecordContribution);
        capital.MapPost("/goals", ProposeGoalAsync).RequireAuthorization(Capabilities.ProposeFundGoal);
        capital.MapPost("/goals/{id:long}/approvals", ApproveGoalAsync).RequireAuthorization(Capabilities.CoSignOperational);
        capital.MapPost("/goals/{id:long}/withdraw", WithdrawGoalAsync);
        capital.MapPost("/corrections", ProposeCorrectionAsync).RequireAuthorization(Capabilities.ProposeCorrection);
        capital.MapPost("/corrections/{id:long}/approvals", ApproveCorrectionAsync).RequireAuthorization(Capabilities.CoSignFinancial);
    }

    private static async Task<IResult> GetCapitalAsync(
        HttpContext context,
        FgpDbContext database,
        CancellationToken cancellationToken)
    {
        if (!TryGetActor(context.User, out var userId, out var organizationId)) return Results.Unauthorized();
        if (!await database.Memberships.AsNoTracking().AnyAsync(item =>
                item.UserId == userId &&
                item.OrganizationId == organizationId &&
                item.Status == MembershipStatus.Active, cancellationToken))
        {
            return Results.Forbid();
        }
        var contributions = await database.CapitalContributions
            .AsNoTracking()
            .Where(item => item.OrganizationId == organizationId && item.IsCurrent && item.Status != CapitalFundStatuses.Removed)
            .OrderByDescending(item => item.ContributionDate)
            .ThenByDescending(item => item.CreatedAt)
            .Join(database.Memberships, item => item.MemberId, member => member.Id, (item, member) => new { item, member })
            .Join(database.Users, item => item.member.UserId, user => user.Id, (item, user) => new
            {
                id = item.item.Id,
                memberId = item.member.Id,
                memberName = user.DisplayName ?? user.Email ?? "Member",
                memberRole = item.member.Role.ToString(),
                contributionDate = item.item.ContributionDate,
                amount = item.item.Amount,
                note = item.item.Note,
                status = item.item.Status,
            })
            .ToListAsync(cancellationToken);
        var goalSetting = await database.OrganizationSettings
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.OrganizationId == organizationId && item.Key == "capital_goal", cancellationToken);
        var goal = goalSetting?.Value.RootElement.TryGetDecimal(out var storedGoal) == true ? storedGoal : 760000m;
        var proposal = await database.CapitalGoalProposals
            .AsNoTracking()
            .Where(item => item.OrganizationId == organizationId && item.Status == CapitalFundStatuses.Open)
            .OrderByDescending(item => item.SubmittedAt)
            .FirstOrDefaultAsync(cancellationToken);
        object? goalResponse = null;
        if (proposal is not null)
        {
            var electorate = await database.CapitalGoalElectorates.Where(item => item.ProposalId == proposal.Id).Select(item => item.MembershipId).ToListAsync(cancellationToken);
            var approvals = await database.CapitalGoalApprovals.Where(item => item.ProposalId == proposal.Id).Select(item => item.MembershipId).ToListAsync(cancellationToken);
            var signatures = await database.Memberships.Where(item => electorate.Contains(item.Id)).Join(database.Users, member => member.UserId, user => user.Id, (member, user) => new { memberId = member.Id, name = user.DisplayName ?? user.Email ?? "Member", role = member.Role.ToString(), signed = approvals.Contains(member.Id) }).ToListAsync(cancellationToken);
            goalResponse = new { id = proposal.Id, newAmount = proposal.NewAmount, approvals, proposedBy = proposal.ProposedByMembershipId, signatures };
        }
        var openCorrections = await database.CapitalCorrectionProposals
            .AsNoTracking()
            .Where(item => item.OrganizationId == organizationId && item.Status == CapitalFundStatuses.Open)
            .ToListAsync(cancellationToken);
        var correctionIds = openCorrections.Select(item => item.Id).ToList();
        var correctionApprovals = await database.CapitalCorrectionApprovals
            .AsNoTracking()
            .Where(item => correctionIds.Contains(item.ProposalId))
            .GroupBy(item => item.ProposalId)
            .Select(group => new { ProposalId = group.Key, Approvers = group.Select(item => item.ApproverMembershipId).ToList() })
            .ToDictionaryAsync(item => item.ProposalId, item => (IReadOnlyList<Guid>)item.Approvers, cancellationToken);
        var correctionSignatories = await database.Memberships
            .AsNoTracking()
            .Where(member =>
                member.OrganizationId == organizationId &&
                member.Status == MembershipStatus.Active &&
                (member.Role == OrganizationRole.Owner || member.Role == OrganizationRole.Chairperson))
            .Join(database.Users, member => member.UserId, user => user.Id, (member, user) => new { member.Id, Name = user.DisplayName ?? user.Email ?? "Member", member.Role })
            .ToListAsync(cancellationToken);
        var corrections = openCorrections.Select(item =>
        {
            var approvals = correctionApprovals.GetValueOrDefault(item.Id, []);
            return new
            {
                item.Id,
                item.ContributionId,
                item.Action,
                approvals,
                proposedBy = item.ProposedByMembershipId,
                proposedByMemberId = item.ProposedByMembershipId,
                item.ProposedAmount,
                item.ProposedNote,
                approved = item.Status == CapitalFundStatuses.Applied,
                item.Status,
                signatures = correctionSignatories.Select(member => new { memberId = member.Id, name = member.Name, role = member.Role.ToString(), signed = approvals.Contains(member.Id) }),
            };
        }).ToList();
        var activeMembers = await database.Memberships
            .AsNoTracking()
            .Where(member => member.OrganizationId == organizationId && member.Status == MembershipStatus.Active)
            .Join(database.Users, member => member.UserId, user => user.Id, (member, user) => new
            {
                memberId = member.Id,
                name = user.DisplayName ?? user.Email ?? "Member",
                role = member.Role,
                status = member.Status.ToString(),
            })
            .ToListAsync(cancellationToken);
        // The fund-goal electorate is every active, non-Viewer member — the same rule
        // GovernanceService applies when it records a proposal's submission electorate.
        var members = activeMembers
            .OrderBy(member => member.role)
            .ThenBy(member => member.name, StringComparer.Ordinal)
            .Select(member => new { member.memberId, member.name, role = member.role.ToString(), member.status })
            .ToList();
        var requiredMembers = activeMembers
            .Where(member => member.role != OrganizationRole.Viewer)
            .OrderBy(member => member.role)
            .ThenBy(member => member.name, StringComparer.Ordinal)
            .Select(member => new { member.memberId, member.name, role = member.role.ToString(), member.status })
            .ToList();
        return Results.Ok(new { contributions, goal, goalProposal = goalResponse, corrections, governance = new { requiredMembers, members } });
    }

    private static async Task<IResult> LegacyCapitalActionAsync(
        [FromBody] LegacyCapitalRequest request,
        HttpContext context,
        FgpDbContext database,
        GovernanceService governance,
        CancellationToken cancellationToken)
    {
        if (!TryGetActor(context.User, out var userId, out var organizationId)) return Results.Unauthorized();
        var actor = await database.Memberships.SingleOrDefaultAsync(item => item.OrganizationId == organizationId && item.UserId == userId && item.Status == MembershipStatus.Active, cancellationToken);
        if (actor is null) return Results.Forbid();
        try
        {
            switch (request.Action)
            {
                case "contribution":
                    var contribution = await governance.RecordContributionAsync(organizationId, userId, new RecordContributionCommand(actor.Id, request.Amount ?? 0, DateOnly.FromDateTime(DateTime.UtcNow), request.Note), cancellationToken);
                    return Results.Json(new { id = contribution.Id, memberName = context.User.Identity?.Name ?? "Member", contributionDate = contribution.ContributionDate, amount = contribution.Amount, note = contribution.Note }, statusCode: StatusCodes.Status201Created);
                case "goal":
                    var goal = await governance.ProposeFundGoalAsync(organizationId, userId, request.NewAmount ?? 0, cancellationToken);
                    return Results.Json(await BuildGoalResponseAsync(database, goal.ProposalId, cancellationToken), statusCode: StatusCodes.Status201Created);
                case "approve-goal":
                    await governance.ApproveFundGoalAsync(organizationId, userId, request.ProposalId ?? 0, cancellationToken);
                    return Results.Ok(await BuildGoalResponseAsync(database, request.ProposalId ?? 0, cancellationToken));
                case "correction":
                    var correction = await governance.ProposeCorrectionAsync(organizationId, userId, new ProposeCorrectionCommand(request.ContributionId ?? 0, request.CorrectionAction ?? "edit", request.Amount, request.ProposedNote), cancellationToken);
                    return Results.Json(await BuildCorrectionResponseAsync(database, correction.Id, cancellationToken), statusCode: StatusCodes.Status201Created);
                case "approve-correction":
                    await governance.ApproveCorrectionAsync(organizationId, userId, request.ProposalId ?? 0, cancellationToken);
                    return Results.Ok(await BuildCorrectionResponseAsync(database, request.ProposalId ?? 0, cancellationToken));
                default:
                    return Results.BadRequest(new { error = "unknown action" });
            }
        }
        catch (GovernanceError error) { return Error(error); }
    }

    private static async Task<object> BuildGoalResponseAsync(FgpDbContext database, long proposalId, CancellationToken cancellationToken)
    {
        var proposal = await database.CapitalGoalProposals.AsNoTracking().SingleAsync(item => item.Id == proposalId, cancellationToken);
        var electorate = await database.CapitalGoalElectorates.Where(item => item.ProposalId == proposalId).Select(item => item.MembershipId).ToListAsync(cancellationToken);
        var approvals = await database.CapitalGoalApprovals.Where(item => item.ProposalId == proposalId).Select(item => item.MembershipId).ToListAsync(cancellationToken);
        var signatures = await database.Memberships
            .AsNoTracking()
            .Where(member => electorate.Contains(member.Id))
            .Join(database.Users, member => member.UserId, user => user.Id, (member, user) => new { member.Id, Name = user.DisplayName ?? user.Email ?? "Member", member.Role, Signed = approvals.Contains(member.Id) })
            .ToListAsync(cancellationToken);
        return new
        {
            id = proposal.Id,
            newAmount = proposal.NewAmount,
            approved = proposal.Status == CapitalFundStatuses.Applied,
            status = proposal.Status,
            approvals,
            proposedBy = proposal.ProposedByMembershipId,
            signatures = signatures.Select(member => new { memberId = member.Id, name = member.Name, role = member.Role.ToString(), signed = member.Signed }),
        };
    }

    private static async Task<object> BuildCorrectionResponseAsync(FgpDbContext database, long proposalId, CancellationToken cancellationToken)
    {
        var proposal = await database.CapitalCorrectionProposals.AsNoTracking().SingleAsync(item => item.Id == proposalId, cancellationToken);
        var approvals = await database.CapitalCorrectionApprovals.Where(item => item.ProposalId == proposalId).Select(item => item.ApproverMembershipId).ToListAsync(cancellationToken);
        var signatures = await database.Memberships
            .AsNoTracking()
            .Where(member =>
                member.OrganizationId == proposal.OrganizationId &&
                member.Status == MembershipStatus.Active &&
                (member.Role == OrganizationRole.Owner || member.Role == OrganizationRole.Chairperson))
            .Join(database.Users, member => member.UserId, user => user.Id, (member, user) => new { member.Id, Name = user.DisplayName ?? user.Email ?? "Member", member.Role, Signed = approvals.Contains(member.Id) })
            .ToListAsync(cancellationToken);
        return new
        {
            id = proposal.Id,
            contributionId = proposal.ContributionId,
            action = proposal.Action,
            approvals,
            proposedBy = proposal.ProposedByMembershipId,
            proposedByMemberId = proposal.ProposedByMembershipId,
            proposedAmount = proposal.ProposedAmount,
            proposedNote = proposal.ProposedNote,
            approved = proposal.Status == CapitalFundStatuses.Applied,
            status = proposal.Status,
            signatures = signatures.Select(member => new { memberId = member.Id, name = member.Name, role = member.Role.ToString(), signed = member.Signed }),
        };
    }

    private static async Task<IResult> RecordContributionAsync(
        RecordContributionRequest request,
        HttpContext context,
        GovernanceService governance,
        FgpDbContext database,
        CancellationToken cancellationToken)
    {
        if (!TryGetActor(context.User, out var userId, out var organizationId)) return Results.Unauthorized();
        try
        {
            var contribution = await governance.RecordContributionAsync(
                organizationId,
                userId,
                new RecordContributionCommand(request.MemberId, request.Amount, request.ContributionDate, request.Note),
                cancellationToken);
            var memberName = await database.Memberships
                .AsNoTracking()
                .Where(member => member.Id == contribution.MemberId)
                .Join(database.Users, member => member.UserId, user => user.Id, (member, user) => user.DisplayName ?? user.Email ?? "Member")
                .SingleOrDefaultAsync(cancellationToken) ?? "Member";
            return Results.Created($"/api/capital/contributions/{contribution.Id}", new
            {
                id = contribution.Id,
                memberName,
                contributionDate = contribution.ContributionDate,
                amount = contribution.Amount,
                note = contribution.Note,
            });
        }
        catch (GovernanceError error)
        {
            return Error(error);
        }
    }

    private static async Task<IResult> ProposeGoalAsync(
        ProposeGoalRequest request,
        HttpContext context,
        GovernanceService governance,
        FgpDbContext database,
        CancellationToken cancellationToken)
    {
        if (!TryGetActor(context.User, out var userId, out var organizationId)) return Results.Unauthorized();
        try
        {
            var proposal = await governance.ProposeFundGoalAsync(organizationId, userId, request.NewAmount, cancellationToken);
            return Results.Created($"/api/capital/goals/{proposal.ProposalId}", await BuildGoalResponseAsync(database, proposal.ProposalId, cancellationToken));
        }
        catch (GovernanceError error)
        {
            return Error(error);
        }
    }

    private static async Task<IResult> ApproveGoalAsync(
        long id,
        HttpContext context,
        GovernanceService governance,
        FgpDbContext database,
        CancellationToken cancellationToken)
    {
        if (!TryGetActor(context.User, out var userId, out var organizationId)) return Results.Unauthorized();
        try
        {
            await governance.ApproveFundGoalAsync(organizationId, userId, id, cancellationToken);
            return Results.Ok(await BuildGoalResponseAsync(database, id, cancellationToken));
        }
        catch (GovernanceError error)
        {
            return Error(error);
        }
    }

    private static async Task<IResult> WithdrawGoalAsync(
        long id,
        HttpContext context,
        GovernanceService governance,
        CancellationToken cancellationToken)
    {
        if (!TryGetActor(context.User, out var userId, out var organizationId)) return Results.Unauthorized();
        try
        {
            await governance.WithdrawFundGoalAsync(organizationId, userId, id, cancellationToken);
            return Results.NoContent();
        }
        catch (GovernanceError error)
        {
            return Error(error);
        }
    }

    private static async Task<IResult> ProposeCorrectionAsync(
        ProposeCorrectionRequest request,
        HttpContext context,
        GovernanceService governance,
        FgpDbContext database,
        CancellationToken cancellationToken)
    {
        if (!TryGetActor(context.User, out var userId, out var organizationId)) return Results.Unauthorized();
        try
        {
            var proposal = await governance.ProposeCorrectionAsync(
                organizationId,
                userId,
                new ProposeCorrectionCommand(request.ContributionId, request.Action, request.ProposedAmount, request.ProposedNote),
                cancellationToken);
            return Results.Created($"/api/capital/corrections/{proposal.Id}", await BuildCorrectionResponseAsync(database, proposal.Id, cancellationToken));
        }
        catch (GovernanceError error)
        {
            return Error(error);
        }
    }

    private static async Task<IResult> ApproveCorrectionAsync(
        long id,
        HttpContext context,
        GovernanceService governance,
        FgpDbContext database,
        CancellationToken cancellationToken)
    {
        if (!TryGetActor(context.User, out var userId, out var organizationId)) return Results.Unauthorized();
        try
        {
            await governance.ApproveCorrectionAsync(organizationId, userId, id, cancellationToken);
            return Results.Ok(await BuildCorrectionResponseAsync(database, id, cancellationToken));
        }
        catch (GovernanceError error)
        {
            return Error(error);
        }
    }

    private static bool TryGetActor(ClaimsPrincipal principal, out Guid userId, out Guid organizationId)
    {
        userId = default;
        organizationId = default;
        return Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out userId) &&
               Guid.TryParse(principal.FindFirstValue("organization_id"), out organizationId);
    }

    private static IResult Error(GovernanceError error) =>
        Results.Json(new ApiError(error.Code, error.Message), statusCode: error.Status);
}

public sealed record RecordContributionRequest(Guid MemberId, decimal Amount, DateOnly ContributionDate, string? Note);
public sealed record ProposeGoalRequest(decimal NewAmount);
public sealed record ProposeCorrectionRequest(long ContributionId, string Action, decimal? ProposedAmount, string? ProposedNote);
public sealed record LegacyCapitalRequest(string? Action, decimal? Amount, string? Note, decimal? NewAmount, long? ContributionId, long? ProposalId, string? CorrectionAction, string? ProposedNote);
