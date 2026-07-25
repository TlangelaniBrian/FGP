using FGP.Api.Identity;
using FGP.Api.Organizations;

namespace FGP.Api.CapitalFund;

public static class CapitalGovernanceRules
{
    public static bool CanProposeFundGoal(OrganizationRole role) => role is OrganizationRole.Owner or OrganizationRole.Chairperson or OrganizationRole.Treasurer;
    public static bool HasMinimumCorrectionGovernance(IEnumerable<MembershipState> members) =>
        members.Count(member => member.Status == MembershipStatus.Active && member.Role == OrganizationRole.Owner) == 1 &&
        members.Count(member => member.Status == MembershipStatus.Active && member.Role == OrganizationRole.Chairperson) == 1;

    public static bool CanApproveCorrection(IEnumerable<MembershipState> members, Guid approverId, Guid proposerId, Guid contributionSubjectId) =>
        HasMinimumCorrectionGovernance(members) && approverId != proposerId && approverId != contributionSubjectId &&
        members.Any(member => member.UserId == approverId && member.Status == MembershipStatus.Active &&
            (member.Role == OrganizationRole.Owner || member.Role == OrganizationRole.Chairperson));

    public static bool HasUnanimousGoalAssent(IEnumerable<Guid> electorateMembershipIds, IEnumerable<Guid> approvalMembershipIds) =>
        electorateMembershipIds.Distinct().Order().SequenceEqual(approvalMembershipIds.Distinct().Order());
}
