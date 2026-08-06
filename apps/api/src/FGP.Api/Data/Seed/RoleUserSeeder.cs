using FGP.Api.Identity;
using FGP.Api.Organizations;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FGP.Api.Data.Seed;

public static class RoleUserSeeder
{
    public const string DemoPassword = "Fgp-Demo-2026!Pass";

    public static readonly IReadOnlyList<(OrganizationRole Role, string Email, string DisplayName)> DemoUsers =
    [
        (OrganizationRole.Owner, "owner@fgp.demo", "Demo Owner"),
        (OrganizationRole.Chairperson, "chairperson@fgp.demo", "Demo Chairperson"),
        (OrganizationRole.Treasurer, "treasurer@fgp.demo", "Demo Treasurer"),
        (OrganizationRole.Analyst, "analyst@fgp.demo", "Demo Analyst"),
        (OrganizationRole.Viewer, "viewer@fgp.demo", "Demo Viewer"),
    ];

    public static async Task SeedAsync(
        FgpDbContext database,
        UserManager<ApplicationUser> userManager,
        Guid organizationId,
        CancellationToken cancellationToken = default)
    {
        var organization = await database.Organizations.SingleOrDefaultAsync(
            item => item.Id == organizationId,
            cancellationToken);
        if (organization is null)
        {
            database.Organizations.Add(new Organization
            {
                Id = organizationId,
                Name = "First Generation Properties (Demo)",
                CreatedAt = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero),
            });
            await database.SaveChangesAsync(cancellationToken);
        }

        foreach (var (role, email, displayName) in DemoUsers)
        {
            var user = await userManager.FindByEmailAsync(email);
            if (user is null)
            {
                user = new ApplicationUser
                {
                    Id = Guid.NewGuid(),
                    UserName = email,
                    Email = email,
                    DisplayName = displayName,
                    EmailConfirmed = true,
                };
                var createResult = await userManager.CreateAsync(user, DemoPassword);
                if (!createResult.Succeeded)
                {
                    throw new InvalidOperationException(
                        $"Demo user {email} could not be created: {string.Join("; ", createResult.Errors.Select(error => error.Description))}");
                }
            }

            var roleOccupied = await database.Memberships.AnyAsync(
                item =>
                    item.OrganizationId == organizationId &&
                    item.Role == role &&
                    item.Status == MembershipStatus.Active,
                cancellationToken);
            if (!roleOccupied)
            {
                var now = DateTimeOffset.UtcNow;
                database.Memberships.Add(new Membership
                {
                    Id = Guid.NewGuid(),
                    OrganizationId = organizationId,
                    UserId = user.Id,
                    Role = role,
                    Status = MembershipStatus.Active,
                    CreatedAt = now,
                    ActivatedAt = now,
                });
            }
        }

        await database.SaveChangesAsync(cancellationToken);
    }
}
