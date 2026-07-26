namespace FGP.Api.CapitalFund;

public static class CapitalFundStatuses
{
    public const string Posted = "posted";
    public const string Corrected = "corrected";
    public const string Removed = "removed";
    public const string Open = "open";
    public const string Applied = "applied";
    public const string Withdrawn = "withdrawn";
    public const string Voided = "voided";
}

public sealed class CapitalContribution
{
    public long Id { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid MemberId { get; set; }
    public Guid RecordedByUserId { get; set; }
    public decimal Amount { get; set; }
    public DateOnly ContributionDate { get; set; }
    public string? Note { get; set; }
    public string Status { get; set; } = CapitalFundStatuses.Posted;
    public long? RootContributionId { get; set; }
    public long? SupersedesContributionId { get; set; }
    public int VersionNumber { get; set; } = 1;
    public bool IsCurrent { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class CapitalGoalProposal
{
    public long Id { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid ProposedByMembershipId { get; set; }
    public decimal NewAmount { get; set; }
    public string Status { get; set; } = CapitalFundStatuses.Open;
    public DateTimeOffset SubmittedAt { get; set; }
    public DateTimeOffset? TerminalAt { get; set; }
}

public sealed class CapitalGoalElectorate
{
    public long ProposalId { get; set; }
    public Guid MembershipId { get; set; }
}

public sealed class CapitalGoalApproval
{
    public long ProposalId { get; set; }
    public Guid MembershipId { get; set; }
    public string ApprovalKind { get; set; } = "IndependentApproval";
    public DateTimeOffset ApprovedAt { get; set; }
}

public sealed class CapitalCorrectionProposal
{
    public long Id { get; set; }
    public Guid OrganizationId { get; set; }
    public long ContributionId { get; set; }
    public Guid ProposedByMembershipId { get; set; }
    public string Action { get; set; } = "edit";
    public decimal? ProposedAmount { get; set; }
    public string? ProposedNote { get; set; }
    public string Status { get; set; } = CapitalFundStatuses.Open;
    public DateTimeOffset SubmittedAt { get; set; }
    public DateTimeOffset? TerminalAt { get; set; }
}

public sealed class CapitalCorrectionApproval
{
    public long ProposalId { get; set; }
    public Guid ApproverMembershipId { get; set; }
    public DateTimeOffset ApprovedAt { get; set; }
}

public sealed class GovernanceAuditEvent
{
    public long Id { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid? ActorUserId { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public long? EntityId { get; set; }
    public long? MembershipEventId { get; set; }
    public string? Details { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
