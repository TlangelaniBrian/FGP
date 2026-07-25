using FGP.Api.Identity;

namespace FGP.Api.Organizations;

public sealed class OrganizationInvitation
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public required string Email { get; set; }
    public OrganizationRole Role { get; set; }
    public Guid InvitedByUserId { get; set; }
    public required byte[] TokenHash { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? AcceptedAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
