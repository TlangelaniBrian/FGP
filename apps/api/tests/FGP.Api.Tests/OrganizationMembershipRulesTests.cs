using FGP.Api.Identity;
using FGP.Api.Organizations;
using Xunit;

namespace FGP.Api.Tests;

public sealed class OrganizationMembershipRulesTests
{
    [Fact]
    public void Cannot_remove_the_only_active_owner()
    {
        var memberships = new[]
        {
            new MembershipState(Guid.NewGuid(), OrganizationRole.Owner, MembershipStatus.Active),
            new MembershipState(Guid.NewGuid(), OrganizationRole.Treasurer, MembershipStatus.Active),
        };

        var allowed = OrganizationMembershipRules.CanChangeStatus(
            memberships,
            memberships[0].UserId,
            MembershipStatus.Removed);

        Assert.False(allowed);
    }

    [Fact]
    public void Cannot_activate_a_second_chairperson()
    {
        var memberships = new[]
        {
            new MembershipState(Guid.NewGuid(), OrganizationRole.Owner, MembershipStatus.Active),
            new MembershipState(Guid.NewGuid(), OrganizationRole.Chairperson, MembershipStatus.Active),
            new MembershipState(Guid.NewGuid(), OrganizationRole.Chairperson, MembershipStatus.Invited),
        };

        var allowed = OrganizationMembershipRules.CanChangeStatus(
            memberships,
            memberships[2].UserId,
            MembershipStatus.Active);

        Assert.False(allowed);
    }
}
