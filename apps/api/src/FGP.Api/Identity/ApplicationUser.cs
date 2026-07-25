using Microsoft.AspNetCore.Identity;

namespace FGP.Api.Identity;

public sealed class ApplicationUser : IdentityUser<Guid>
{
    public string? DisplayName { get; set; }
}
