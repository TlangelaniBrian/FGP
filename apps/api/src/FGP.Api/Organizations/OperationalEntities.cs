using System.Text.Json;

namespace FGP.Api.Organizations;

public sealed class OrganizationSetting
{
    public Guid OrganizationId { get; set; }
    public required string Key { get; set; }
    public required JsonDocument Value { get; set; }
    public Guid? UpdatedByUserId { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class ActivityEvent
{
    public long Id { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid? ActorUserId { get; set; }
    public string? ActorName { get; set; }
    public required string EventType { get; set; }
    public required string Title { get; set; }
    public string? Detail { get; set; }
    public string? EntityType { get; set; }
    public string? EntityId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
