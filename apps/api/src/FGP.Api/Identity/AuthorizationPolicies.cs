using FGP.Api.Data;
using FGP.Api.Organizations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace FGP.Api.Identity;

public enum OrganizationRole
{
    Owner,
    Chairperson,
    Treasurer,
    Analyst,
    Viewer,
}

public static class Capabilities
{
    public const string ManageTeam = "ManageTeam";
    public const string EditTariffs = "EditTariffs";
    public const string RecordContribution = "RecordContribution";
    public const string CoSignFinancial = "CoSignFinancial";
    public const string CoSignOperational = "CoSignOperational";
    public const string ProposeFundGoal = "ProposeFundGoal";
    public const string ProposeCorrection = "ProposeCorrection";

    public static IReadOnlyList<string> All { get; } =
    [
        ManageTeam,
        EditTariffs,
        RecordContribution,
        CoSignFinancial,
        CoSignOperational,
        ProposeFundGoal,
        ProposeCorrection,
    ];
}

public static class CapabilityPolicy
{
    private static readonly IReadOnlyDictionary<OrganizationRole, IReadOnlySet<string>> RoleCapabilities =
        new Dictionary<OrganizationRole, IReadOnlySet<string>>
        {
            [OrganizationRole.Owner] = new HashSet<string>
            {
                Capabilities.ManageTeam,
                Capabilities.EditTariffs,
                Capabilities.RecordContribution,
                Capabilities.CoSignFinancial,
                Capabilities.CoSignOperational,
                Capabilities.ProposeFundGoal,
                Capabilities.ProposeCorrection,
            },
            [OrganizationRole.Chairperson] = new HashSet<string>
            {
                Capabilities.ManageTeam,
                Capabilities.EditTariffs,
                Capabilities.RecordContribution,
                Capabilities.CoSignFinancial,
                Capabilities.CoSignOperational,
                Capabilities.ProposeFundGoal,
                Capabilities.ProposeCorrection,
            },
            [OrganizationRole.Treasurer] = new HashSet<string>
            {
                Capabilities.RecordContribution,
                Capabilities.CoSignOperational,
                Capabilities.ProposeFundGoal,
                Capabilities.ProposeCorrection,
            },
            [OrganizationRole.Analyst] = new HashSet<string>
            {
                Capabilities.RecordContribution,
                Capabilities.CoSignOperational,
            },
            [OrganizationRole.Viewer] = new HashSet<string>(),
        };

    public static bool Allows(OrganizationRole role, string capability) =>
        RoleCapabilities[role].Contains(capability);

    public static IReadOnlySet<string> For(OrganizationRole role) => RoleCapabilities[role];
}

public sealed record CapabilityRequirement(string Capability) : IAuthorizationRequirement;

public sealed class CapabilityAuthorizationHandler(FgpDbContext database) : AuthorizationHandler<CapabilityRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        CapabilityRequirement requirement)
    {
        var subject = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        var organization = context.User.FindFirstValue("organization_id");
        if (!Guid.TryParse(subject, out var userId) ||
            !Guid.TryParse(organization, out var organizationId))
        {
            return;
        }

        var membership = await database.Memberships
            .AsNoTracking()
            .Where(candidate =>
                candidate.UserId == userId &&
                candidate.OrganizationId == organizationId &&
                candidate.Status == MembershipStatus.Active)
            .Select(candidate => (OrganizationRole?)candidate.Role)
            .SingleOrDefaultAsync();
        if (membership is { } role && CapabilityPolicy.Allows(role, requirement.Capability))
        {
            context.Succeed(requirement);
        }
    }
}
