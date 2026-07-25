namespace FGP.Api.Data.Entities;

public sealed class Project
{
    public long Id { get; set; }
    public Guid? UserId { get; set; }
    public long? ListingId { get; set; }
    public long? ReportId { get; set; }
    public string? Name { get; set; }
    public string Status { get; set; } = "planning";
    public string? Notes { get; set; }
    public string? ErfNumber { get; set; }
    public string? Township { get; set; }
    public string[]? Partners { get; set; }
    public decimal? MonthlySavingZar { get; set; }
    public decimal? Phase1TargetZar { get; set; }
    public string Scenario { get; set; } = "base";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class ProjectBudgetItem
{
    public long Id { get; set; }
    public long ProjectId { get; set; }
    public required string Category { get; set; }
    public required string Item { get; set; }
    public string? Description { get; set; }
    public string? Unit { get; set; }
    public decimal? Quantity { get; set; }
    public decimal? UnitCost { get; set; }
    public decimal? TotalCost { get; set; }
    public decimal? ActualCost { get; set; }
    public string Status { get; set; } = "estimate";
    public string? Timeline { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class ProjectContact
{
    public long Id { get; set; }
    public long ProjectId { get; set; }
    public required string Role { get; set; }
    public string? Name { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string Status { get; set; } = "pending";
    public string? Notes { get; set; }
}

public sealed class ProjectDecision
{
    public long Id { get; set; }
    public long ProjectId { get; set; }
    public DateOnly DecidedAt { get; set; }
    public required string Decision { get; set; }
    public string? Rationale { get; set; }
    public string? Impact { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class ProjectCheckin
{
    public long Id { get; set; }
    public long ProjectId { get; set; }
    public DateOnly WeekOf { get; set; }
    public string? AttorneyStatus { get; set; }
    public bool? SavingsConfirmed { get; set; }
    public decimal? DepositZar { get; set; }
    public string? SupplierProgress { get; set; }
    public string? OpenIssues { get; set; }
    public string? ActionsNextCall { get; set; }
    public string? DecisionsNeeded { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class Milestone
{
    public long Id { get; set; }
    public long ProjectId { get; set; }
    public required string TargetDate { get; set; }
    public required string Name { get; set; }
    public string Status { get; set; } = "PENDING";
    public string? Owner { get; set; }
    public bool IsMajor { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
