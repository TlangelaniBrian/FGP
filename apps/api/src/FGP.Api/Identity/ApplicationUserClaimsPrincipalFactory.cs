using FGP.Api.Data;
using FGP.Api.Organizations;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Security.Claims;

namespace FGP.Api.Identity;

public sealed class ApplicationUserClaimsPrincipalFactory(
    UserManager<ApplicationUser> userManager,
    RoleManager<IdentityRole<Guid>> roleManager,
    IOptions<IdentityOptions> options,
    FgpDbContext database)
    : UserClaimsPrincipalFactory<ApplicationUser, IdentityRole<Guid>>(userManager, roleManager, options)
{
    protected override async Task<ClaimsIdentity> GenerateClaimsAsync(ApplicationUser user)
    {
        var identity = await base.GenerateClaimsAsync(user);
        var membership = await database.Memberships
            .AsNoTracking()
            .Where(candidate => candidate.UserId == user.Id && candidate.Status == MembershipStatus.Active)
            .OrderBy(candidate => candidate.CreatedAt)
            .FirstOrDefaultAsync();

        if (membership is not null)
        {
            identity.AddClaim(new Claim("organization_id", membership.OrganizationId.ToString()));
            identity.AddClaim(new Claim(ClaimTypes.Role, membership.Role.ToString()));
        }

        return identity;
    }
}
