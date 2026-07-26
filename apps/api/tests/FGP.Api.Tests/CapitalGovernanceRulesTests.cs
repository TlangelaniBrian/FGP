using FGP.Api.CapitalFund;
using FGP.Api.Identity;
using FGP.Api.Organizations;
using Xunit;

namespace FGP.Api.Tests;

public sealed class CapitalGovernanceRulesTests
{
    [Theory]
    [InlineData(OrganizationRole.Owner, true)]
    [InlineData(OrganizationRole.Chairperson, true)]
    [InlineData(OrganizationRole.Treasurer, true)]
    [InlineData(OrganizationRole.Analyst, false)]
    [InlineData(OrganizationRole.Viewer, false)]
    public void Fund_goal_proposal_capability_matches_the_approved_role_table(OrganizationRole role, bool expected) =>
        Assert.Equal(expected, CapitalGovernanceRules.CanProposeFundGoal(role));

    [Fact]
    public void Correction_approval_requires_a_distinct_governing_checker()
    {
        var owner = Guid.NewGuid(); var chair = Guid.NewGuid(); var treasurer = Guid.NewGuid(); var analyst = Guid.NewGuid();
        var members = new[] { new MembershipState(owner, OrganizationRole.Owner, MembershipStatus.Active), new MembershipState(chair, OrganizationRole.Chairperson, MembershipStatus.Active), new MembershipState(treasurer, OrganizationRole.Treasurer, MembershipStatus.Active), new MembershipState(analyst, OrganizationRole.Analyst, MembershipStatus.Active) };
        Assert.True(CapitalGovernanceRules.CanApproveCorrection(members, chair, treasurer, analyst));
        Assert.False(CapitalGovernanceRules.CanApproveCorrection(members, treasurer, chair, analyst));
        Assert.False(CapitalGovernanceRules.CanApproveCorrection(members, chair, chair, analyst));
        Assert.False(CapitalGovernanceRules.CanApproveCorrection(members, chair, treasurer, chair));
    }

    [Fact]
    public void Correction_requires_both_governing_roles_without_operational_downgrade()
    {
        var owner = Guid.NewGuid(); var treasurer = Guid.NewGuid();
        var members = new[] { new MembershipState(owner, OrganizationRole.Owner, MembershipStatus.Active), new MembershipState(treasurer, OrganizationRole.Treasurer, MembershipStatus.Active) };
        Assert.False(CapitalGovernanceRules.HasMinimumCorrectionGovernance(members));
        Assert.False(CapitalGovernanceRules.CanApproveCorrection(members, owner, treasurer, treasurer));
    }

    [Fact]
    public void Correction_proposal_has_no_eligible_approver_when_owner_is_subject_of_chair_proposal()
    {
        var owner = Guid.NewGuid();
        var chair = Guid.NewGuid();
        var members = new[]
        {
            new MembershipState(owner, OrganizationRole.Owner, MembershipStatus.Active),
            new MembershipState(chair, OrganizationRole.Chairperson, MembershipStatus.Active),
        };

        Assert.False(CapitalGovernanceRules.HasEligibleCorrectionApprover(members, chair, owner));
    }

    [Fact]
    public void Correction_proposal_retains_the_other_governor_as_eligible_checker()
    {
        var owner = Guid.NewGuid();
        var chair = Guid.NewGuid();
        var treasurer = Guid.NewGuid();
        var members = new[]
        {
            new MembershipState(owner, OrganizationRole.Owner, MembershipStatus.Active),
            new MembershipState(chair, OrganizationRole.Chairperson, MembershipStatus.Active),
            new MembershipState(treasurer, OrganizationRole.Treasurer, MembershipStatus.Active),
        };

        Assert.True(CapitalGovernanceRules.HasEligibleCorrectionApprover(members, treasurer, owner));
    }

    [Fact]
    public void Fund_goal_assent_requires_exactly_the_submission_electorate()
    {
        var electorate = new[] { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() };

        Assert.False(CapitalGovernanceRules.HasUnanimousGoalAssent(electorate, electorate[..2]));
        Assert.False(CapitalGovernanceRules.HasUnanimousGoalAssent(electorate, electorate.Append(Guid.NewGuid())));
        Assert.True(CapitalGovernanceRules.HasUnanimousGoalAssent(electorate, electorate.Reverse()));
    }
}
