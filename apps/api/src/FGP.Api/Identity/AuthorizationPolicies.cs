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
