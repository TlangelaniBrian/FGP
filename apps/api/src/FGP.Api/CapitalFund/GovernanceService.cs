using FGP.Api.Data;
using FGP.Api.Identity;
using FGP.Api.Organizations;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Data;
using System.Text.Json;

namespace FGP.Api.CapitalFund;

public sealed class GovernanceService(FgpDbContext database)
{
    public async Task<CapitalContribution> RecordContributionAsync(
        Guid organizationId,
        Guid actorUserId,
        RecordContributionCommand request,
        CancellationToken cancellationToken)
    {
        var actor = await RequireActorAsync(organizationId, actorUserId, Capabilities.RecordContribution, cancellationToken);
        if (request.Amount <= 0 || request.ContributionDate == default)
        {
            throw new GovernanceError("InvalidContribution", "A positive amount and contribution date are required.", 422);
        }

        var subject = await database.Memberships.SingleOrDefaultAsync(member =>
            member.Id == request.MemberId &&
            member.OrganizationId == organizationId &&
            member.Status == MembershipStatus.Active, cancellationToken);
        if (subject is null)
        {
            throw new GovernanceError("MemberNotFound", "The contribution member was not found.", 404);
        }

        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var contribution = new CapitalContribution
        {
            OrganizationId = organizationId,
            MemberId = subject.Id,
            RecordedByUserId = actor.UserId,
            Amount = request.Amount,
            ContributionDate = request.ContributionDate,
            Note = request.Note?.Trim(),
            CreatedAt = DateTimeOffset.UtcNow,
        };
        database.CapitalContributions.Add(contribution);
        await database.SaveChangesAsync(cancellationToken);
        AddAudit(organizationId, actor.UserId, "contribution_recorded", "capital_contribution", contribution.Id, null, request.Amount.ToString("0.00"));
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return contribution;
    }

    public async Task<CapitalCorrectionProposal> ProposeCorrectionAsync(
        Guid organizationId,
        Guid actorUserId,
        ProposeCorrectionCommand request,
        CancellationToken cancellationToken)
    {
        var actor = await RequireActorAsync(organizationId, actorUserId, Capabilities.ProposeCorrection, cancellationToken);
        if (request.Action is not ("edit" or "remove") ||
            (request.Action == "edit" && request.ProposedAmount is not > 0))
        {
            throw new GovernanceError("InvalidCorrection", "An edit requires a positive amount; action must be edit or remove.", 422);
        }

        var contribution = await database.CapitalContributions.SingleOrDefaultAsync(item =>
            item.Id == request.ContributionId &&
            item.OrganizationId == organizationId &&
            item.IsCurrent &&
            item.Status != CapitalFundStatuses.Removed, cancellationToken);
        if (contribution is null)
        {
            throw new GovernanceError("ContributionNotFound", "The current contribution was not found.", 404);
        }

        var members = await database.Memberships
            .Where(member => member.OrganizationId == organizationId)
            .ToListAsync(cancellationToken);
        var subject = members.SingleOrDefault(member => member.Id == contribution.MemberId);
        if (subject is null)
        {
            throw new GovernanceError("CorrectionIdentityMissing", "The contribution member is no longer available.", 409);
        }
        var states = members.Select(member => new MembershipState(member.UserId, member.Role, member.Status));
        if (!CapitalGovernanceRules.HasMinimumCorrectionGovernance(states))
        {
            throw new GovernanceError("MinimumGovernanceRequired", "Appoint one active Owner and Chairperson before proposing corrections.", 409);
        }
        if (!CapitalGovernanceRules.HasEligibleCorrectionApprover(states, actor.UserId, subject.UserId))
        {
            throw new GovernanceError("NoEligibleApprover", "The correction has no distinct active Owner or Chairperson eligible to approve it.", 409);
        }

        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var proposal = new CapitalCorrectionProposal
        {
            OrganizationId = organizationId,
            ContributionId = contribution.Id,
            ProposedByMembershipId = actor.Id,
            Action = request.Action,
            ProposedAmount = request.ProposedAmount,
            ProposedNote = request.ProposedNote?.Trim(),
            SubmittedAt = DateTimeOffset.UtcNow,
        };
        database.CapitalCorrectionProposals.Add(proposal);
        await database.SaveChangesAsync(cancellationToken);
        AddAudit(organizationId, actor.UserId, "correction_proposed", "capital_correction", proposal.Id, null, $"contribution:{contribution.Id};action:{request.Action}");
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return proposal;
    }

    public Task<CorrectionApprovalResult> ApproveCorrectionAsync(
        Guid organizationId,
        Guid actorUserId,
        long proposalId,
        CancellationToken cancellationToken) =>
        ExecuteSerializableAsync(
            () => ApproveCorrectionOnceAsync(organizationId, actorUserId, proposalId, cancellationToken),
            cancellationToken);

    private async Task<CorrectionApprovalResult> ApproveCorrectionOnceAsync(
        Guid organizationId,
        Guid actorUserId,
        long proposalId,
        CancellationToken cancellationToken)
    {
        var actor = await RequireActorAsync(organizationId, actorUserId, Capabilities.CoSignFinancial, cancellationToken);
        await using var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        var proposal = await database.CapitalCorrectionProposals.SingleOrDefaultAsync(item =>
            item.Id == proposalId && item.OrganizationId == organizationId, cancellationToken);
        if (proposal is null)
        {
            throw new GovernanceError("CorrectionNotFound", "The correction proposal was not found.", 404);
        }
        if (proposal.Status != CapitalFundStatuses.Open)
        {
            throw new GovernanceError("CorrectionClosed", "The correction proposal is no longer open.", 409);
        }

        var contribution = await database.CapitalContributions.SingleOrDefaultAsync(item =>
            item.Id == proposal.ContributionId && item.OrganizationId == organizationId && item.IsCurrent,
            cancellationToken);
        if (contribution is null)
        {
            throw new GovernanceError("ContributionNotFound", "The current contribution was not found.", 409);
        }

        var members = await database.Memberships
            .Where(member => member.OrganizationId == organizationId)
            .ToListAsync(cancellationToken);
        var proposer = members.SingleOrDefault(member => member.Id == proposal.ProposedByMembershipId);
        var subject = members.SingleOrDefault(member => member.Id == contribution.MemberId);
        if (proposer is null || subject is null)
        {
            throw new GovernanceError("CorrectionIdentityMissing", "The correction identities are no longer available.", 409);
        }
        var states = members.Select(member => new MembershipState(member.UserId, member.Role, member.Status)).ToArray();
        if (!CapitalGovernanceRules.HasMinimumCorrectionGovernance(states))
        {
            throw new GovernanceError("MinimumGovernanceRequired", "One active Owner and Chairperson are required to approve corrections.", 409);
        }
        if (!CapitalGovernanceRules.HasEligibleCorrectionApprover(states, proposer.UserId, subject.UserId))
        {
            throw new GovernanceError("NoEligibleApprover", "The correction has no distinct active Owner or Chairperson eligible to approve it.", 409);
        }
        if (!CapitalGovernanceRules.CanApproveCorrection(states, actor.UserId, proposer.UserId, subject.UserId))
        {
            throw new GovernanceError("CorrectionConflict", "The proposer and contribution subject cannot approve this correction.", 403);
        }

        var alreadyApproved = await database.CapitalCorrectionApprovals.AnyAsync(approval =>
            approval.ProposalId == proposalId && approval.ApproverMembershipId == actor.Id, cancellationToken);
        if (alreadyApproved)
        {
            throw new GovernanceError("CorrectionAlreadyApproved", "This correction has already been approved by the current member.", 409);
        }

        database.CapitalCorrectionApprovals.Add(new CapitalCorrectionApproval
        {
            ProposalId = proposalId,
            ApproverMembershipId = actor.Id,
            ApprovedAt = DateTimeOffset.UtcNow,
        });
        contribution.IsCurrent = false;
        var corrected = new CapitalContribution
        {
            OrganizationId = contribution.OrganizationId,
            MemberId = contribution.MemberId,
            RecordedByUserId = contribution.RecordedByUserId,
            Amount = proposal.Action == "remove" ? contribution.Amount : proposal.ProposedAmount!.Value,
            ContributionDate = contribution.ContributionDate,
            Note = proposal.Action == "remove" ? contribution.Note : proposal.ProposedNote ?? contribution.Note,
            Status = proposal.Action == "remove" ? CapitalFundStatuses.Removed : CapitalFundStatuses.Corrected,
            RootContributionId = contribution.RootContributionId ?? contribution.Id,
            SupersedesContributionId = contribution.Id,
            VersionNumber = contribution.VersionNumber + 1,
            IsCurrent = true,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        database.CapitalContributions.Add(corrected);
        proposal.Status = CapitalFundStatuses.Applied;
        proposal.TerminalAt = DateTimeOffset.UtcNow;
        AddAudit(organizationId, actor.UserId, "correction_approved", "capital_correction", proposalId, null, $"version:{corrected.VersionNumber};contribution:{contribution.Id}");
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new CorrectionApprovalResult(proposal.Id, proposal.Status, corrected.Id, true);
    }

    public Task<GoalProposalResult> ProposeFundGoalAsync(
        Guid organizationId,
        Guid actorUserId,
        decimal newAmount,
        CancellationToken cancellationToken) =>
        ExecuteSerializableAsync(
            () => ProposeFundGoalOnceAsync(organizationId, actorUserId, newAmount, cancellationToken),
            cancellationToken);

    private async Task<GoalProposalResult> ProposeFundGoalOnceAsync(
        Guid organizationId,
        Guid actorUserId,
        decimal newAmount,
        CancellationToken cancellationToken)
    {
        var actor = await RequireActorAsync(organizationId, actorUserId, Capabilities.ProposeFundGoal, cancellationToken);
        if (newAmount <= 0)
        {
            throw new GovernanceError("InvalidFundGoal", "A positive goal amount is required.", 422);
        }

        await using var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        if (await database.CapitalGoalProposals.AnyAsync(goal => goal.OrganizationId == organizationId && goal.Status == CapitalFundStatuses.Open, cancellationToken))
        {
            throw new GovernanceError("OpenGoalExists", "Withdraw or resolve the open fund-goal proposal first.", 409);
        }

        var electorate = await database.Memberships
            .Where(member => member.OrganizationId == organizationId && member.Status == MembershipStatus.Active && member.Role != OrganizationRole.Viewer)
            .ToListAsync(cancellationToken);
        if (!electorate.Any(member => member.Id == actor.Id))
        {
            throw new GovernanceError("NotInElectorate", "The proposer is not in the active fund-goal electorate.", 403);
        }

        var proposal = new CapitalGoalProposal
        {
            OrganizationId = organizationId,
            ProposedByMembershipId = actor.Id,
            NewAmount = newAmount,
            SubmittedAt = DateTimeOffset.UtcNow,
        };
        database.CapitalGoalProposals.Add(proposal);
        await database.SaveChangesAsync(cancellationToken);
        database.CapitalGoalElectorates.AddRange(electorate.Select(member => new CapitalGoalElectorate
        {
            ProposalId = proposal.Id,
            MembershipId = member.Id,
        }));
        database.CapitalGoalApprovals.Add(new CapitalGoalApproval
        {
            ProposalId = proposal.Id,
            MembershipId = actor.Id,
            ApprovalKind = "AssentBySubmission",
            ApprovedAt = DateTimeOffset.UtcNow,
        });
        AddAudit(organizationId, actor.UserId, "fund_goal_submitted", "capital_goal", proposal.Id, null, $"amount:{newAmount:0.00};electorate:{electorate.Count}");
        await database.SaveChangesAsync(cancellationToken);

        if (electorate.Count == 1)
        {
            await ApplyGoalAsync(proposal, actor.UserId, cancellationToken);
        }
        var result = await BuildGoalResultAsync(proposal.Id, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return result;
    }

    public Task<GoalProposalResult> ApproveFundGoalAsync(
        Guid organizationId,
        Guid actorUserId,
        long proposalId,
        CancellationToken cancellationToken) =>
        ExecuteSerializableAsync(
            () => ApproveFundGoalOnceAsync(organizationId, actorUserId, proposalId, cancellationToken),
            cancellationToken);

    private async Task<GoalProposalResult> ApproveFundGoalOnceAsync(
        Guid organizationId,
        Guid actorUserId,
        long proposalId,
        CancellationToken cancellationToken)
    {
        var actor = await RequireActorAsync(organizationId, actorUserId, Capabilities.CoSignOperational, cancellationToken);
        await using var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        var proposal = await database.CapitalGoalProposals.SingleOrDefaultAsync(goal =>
            goal.Id == proposalId && goal.OrganizationId == organizationId, cancellationToken);
        if (proposal is null)
        {
            throw new GovernanceError("GoalNotFound", "The fund-goal proposal was not found.", 404);
        }
        if (proposal.Status != CapitalFundStatuses.Open)
        {
            throw new GovernanceError("GoalClosed", "The fund-goal proposal is no longer open.", 409);
        }
        var inElectorate = await database.CapitalGoalElectorates.AnyAsync(item => item.ProposalId == proposalId && item.MembershipId == actor.Id, cancellationToken);
        if (!inElectorate)
        {
            throw new GovernanceError("NotInElectorate", "The member was not in the proposal's submission electorate.", 403);
        }
        if (await database.CapitalGoalApprovals.AnyAsync(item => item.ProposalId == proposalId && item.MembershipId == actor.Id, cancellationToken))
        {
            throw new GovernanceError("GoalAlreadyApproved", "This member has already approved the fund-goal proposal.", 409);
        }

        database.CapitalGoalApprovals.Add(new CapitalGoalApproval
        {
            ProposalId = proposalId,
            MembershipId = actor.Id,
            ApprovalKind = "IndependentApproval",
            ApprovedAt = DateTimeOffset.UtcNow,
        });
        AddAudit(organizationId, actor.UserId, "fund_goal_approved", "capital_goal", proposalId, null, null);
        await database.SaveChangesAsync(cancellationToken);

        var electorateIds = await database.CapitalGoalElectorates
            .Where(item => item.ProposalId == proposalId)
            .Select(item => item.MembershipId)
            .ToListAsync(cancellationToken);
        var approvalIds = await database.CapitalGoalApprovals
            .Where(item => item.ProposalId == proposalId)
            .Select(item => item.MembershipId)
            .ToListAsync(cancellationToken);
        if (CapitalGovernanceRules.HasUnanimousGoalAssent(electorateIds, approvalIds))
        {
            await ApplyGoalAsync(proposal, actor.UserId, cancellationToken);
        }
        var result = await BuildGoalResultAsync(proposal.Id, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return result;
    }

    public async Task WithdrawFundGoalAsync(
        Guid organizationId,
        Guid actorUserId,
        long proposalId,
        CancellationToken cancellationToken)
    {
        var actor = await RequireActorAsync(organizationId, actorUserId, null, cancellationToken);
        var proposal = await database.CapitalGoalProposals.SingleOrDefaultAsync(goal =>
            goal.Id == proposalId && goal.OrganizationId == organizationId && goal.Status == CapitalFundStatuses.Open, cancellationToken);
        if (proposal is null)
        {
            throw new GovernanceError("GoalNotFound", "The open fund-goal proposal was not found.", 404);
        }
        if (proposal.ProposedByMembershipId != actor.Id && actor.Role is not (OrganizationRole.Owner or OrganizationRole.Chairperson))
        {
            throw new GovernanceError("GoalWithdrawalForbidden", "Only the proposer, Owner, or Chairperson may withdraw a fund goal.", 403);
        }

        proposal.Status = CapitalFundStatuses.Withdrawn;
        proposal.TerminalAt = DateTimeOffset.UtcNow;
        AddAudit(organizationId, actor.UserId, "fund_goal_withdrawn", "capital_goal", proposalId, null, null);
        await database.SaveChangesAsync(cancellationToken);
    }

    public async Task VoidOpenGoalsForMembershipChangeAsync(
        Guid organizationId,
        long membershipEventId,
        Guid? actorUserId,
        CancellationToken cancellationToken)
    {
        var openGoals = await database.CapitalGoalProposals
            .Where(goal => goal.OrganizationId == organizationId && goal.Status == CapitalFundStatuses.Open)
            .ToListAsync(cancellationToken);
        foreach (var goal in openGoals)
        {
            goal.Status = CapitalFundStatuses.Voided;
            goal.TerminalAt = DateTimeOffset.UtcNow;
            AddAudit(organizationId, actorUserId, "fund_goal_voided_membership_change", "capital_goal", goal.Id, membershipEventId, null);
        }
        await database.SaveChangesAsync(cancellationToken);
    }

    private async Task<Membership> RequireActorAsync(Guid organizationId, Guid userId, string? capability, CancellationToken cancellationToken)
    {
        var actor = await database.Memberships.SingleOrDefaultAsync(member =>
            member.OrganizationId == organizationId && member.UserId == userId && member.Status == MembershipStatus.Active, cancellationToken);
        if (actor is null)
        {
            throw new GovernanceError("NoActiveOrganization", "No active organisation membership is available.", 403);
        }
        if (capability is not null && !CapabilityPolicy.Allows(actor.Role, capability))
        {
            throw new GovernanceError("CapabilityRequired", "The current role cannot perform this action.", 403);
        }
        return actor;
    }

    private async Task ApplyGoalAsync(CapitalGoalProposal proposal, Guid actorUserId, CancellationToken cancellationToken)
    {
        proposal.Status = CapitalFundStatuses.Applied;
        proposal.TerminalAt = DateTimeOffset.UtcNow;
        var setting = await database.OrganizationSettings.SingleOrDefaultAsync(item =>
            item.OrganizationId == proposal.OrganizationId && item.Key == "capital_goal", cancellationToken);
        using var value = JsonSerializer.SerializeToDocument(proposal.NewAmount);
        if (setting is null)
        {
            database.OrganizationSettings.Add(new OrganizationSetting
            {
                OrganizationId = proposal.OrganizationId,
                Key = "capital_goal",
                Value = value,
                UpdatedByUserId = actorUserId,
                UpdatedAt = DateTimeOffset.UtcNow,
            });
        }
        else
        {
            setting.Value = value;
            setting.UpdatedByUserId = actorUserId;
            setting.UpdatedAt = DateTimeOffset.UtcNow;
        }
        AddAudit(proposal.OrganizationId, actorUserId, "fund_goal_applied", "capital_goal", proposal.Id, null, $"amount:{proposal.NewAmount:0.00}");
        await database.SaveChangesAsync(cancellationToken);
    }

    private async Task<GoalProposalResult> BuildGoalResultAsync(long proposalId, CancellationToken cancellationToken)
    {
        var proposal = await database.CapitalGoalProposals.AsNoTracking().SingleAsync(item => item.Id == proposalId, cancellationToken);
        var electorate = await database.CapitalGoalElectorates.AsNoTracking().Where(item => item.ProposalId == proposalId).Select(item => item.MembershipId).ToListAsync(cancellationToken);
        var approvals = await database.CapitalGoalApprovals.AsNoTracking().Where(item => item.ProposalId == proposalId).Select(item => item.MembershipId).ToListAsync(cancellationToken);
        return new GoalProposalResult(proposal.Id, proposal.Status, proposal.NewAmount, electorate, approvals);
    }

    private void AddAudit(Guid organizationId, Guid? actorUserId, string eventType, string entityType, long? entityId, long? membershipEventId, string? details)
    {
        database.GovernanceAuditEvents.Add(new GovernanceAuditEvent
        {
            OrganizationId = organizationId,
            ActorUserId = actorUserId,
            EventType = eventType,
            EntityType = entityType,
            EntityId = entityId,
            MembershipEventId = membershipEventId,
            Details = details,
            CreatedAt = DateTimeOffset.UtcNow,
        });
    }

    private async Task<T> ExecuteSerializableAsync<T>(Func<Task<T>> operation, CancellationToken cancellationToken)
    {
        const int maxAttempts = 3;
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                return await operation();
            }
            catch (Exception exception) when (IsSerializationFailure(exception) && attempt < maxAttempts)
            {
                database.ChangeTracker.Clear();
                await Task.Delay(TimeSpan.FromMilliseconds(25 * attempt), cancellationToken);
            }
        }
    }

    private static bool IsSerializationFailure(Exception exception)
    {
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current is PostgresException { SqlState: "40001" })
            {
                return true;
            }
        }

        return false;
    }
}

public sealed record RecordContributionCommand(Guid MemberId, decimal Amount, DateOnly ContributionDate, string? Note);
public sealed record ProposeCorrectionCommand(long ContributionId, string Action, decimal? ProposedAmount, string? ProposedNote);
public sealed record CorrectionApprovalResult(long ProposalId, string Status, long CorrectedContributionId, bool Changed);
public sealed record GoalProposalResult(long ProposalId, string Status, decimal NewAmount, IReadOnlyList<Guid> Electorate, IReadOnlyList<Guid> Approvals);
public sealed class GovernanceError(string code, string message, int status) : Exception(message)
{
    public string Code { get; } = code;
    public int Status { get; } = status;
}
