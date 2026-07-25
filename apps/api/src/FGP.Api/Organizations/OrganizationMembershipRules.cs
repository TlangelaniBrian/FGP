using FGP.Api.Identity;

namespace FGP.Api.Organizations;

public enum MembershipStatus
{
    Invited,
    Active,
    Suspended,
    Removed,
}

public sealed record MembershipState(Guid UserId, OrganizationRole Role, MembershipStatus Status);

public static class OrganizationMembershipRules
{
    public static bool HasValidActiveLeadership(IEnumerable<MembershipState> memberships)
    {
        var activeMemberships = memberships
            .Where(membership => membership.Status == MembershipStatus.Active)
            .ToArray();

        return activeMemberships.Count(membership => membership.Role == OrganizationRole.Owner) == 1 &&
               activeMemberships.Count(membership => membership.Role == OrganizationRole.Chairperson) <= 1;
    }

    public static bool CanChangeStatus(
        IEnumerable<MembershipState> memberships,
        Guid userId,
        MembershipStatus nextStatus)
    {
        var currentMemberships = memberships.ToArray();
        var target = currentMemberships.SingleOrDefault(membership => membership.UserId == userId);
        if (target is null) return false;

        var projected = currentMemberships
            .Select(membership => membership.UserId == userId
                ? membership with { Status = nextStatus }
                : membership)
            .Where(membership => membership.Status == MembershipStatus.Active)
            .ToArray();

        return HasValidActiveLeadership(projected);
    }
}
