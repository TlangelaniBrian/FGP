using FGP.Api.Identity;
using Xunit;

namespace FGP.Api.Tests;

public sealed class AuthorizationPolicyTests
{
    [Theory]
    [InlineData(OrganizationRole.Owner, Capabilities.CoSignFinancial, true)]
    [InlineData(OrganizationRole.Chairperson, Capabilities.CoSignFinancial, true)]
    [InlineData(OrganizationRole.Treasurer, Capabilities.CoSignFinancial, false)]
    [InlineData(OrganizationRole.Analyst, Capabilities.CoSignFinancial, false)]
    [InlineData(OrganizationRole.Viewer, Capabilities.RecordContribution, false)]
    [InlineData(OrganizationRole.Chairperson, Capabilities.ProposeFundGoal, true)]
    public void Capability_policy_is_role_scoped(OrganizationRole role, string capability, bool expected)
    {
        Assert.Equal(expected, CapabilityPolicy.Allows(role, capability));
    }
}
