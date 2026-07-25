using FGP.Api.Data;
using FGP.Api.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace FGP.Api.Organizations;

public static class OrganizationEndpoints
{
    public static void MapOrganizationEndpoints(this WebApplication app)
    {
        var organizations = app.MapGroup("/api/organizations");
        organizations.MapPost("/invitations", CreateInvitationAsync).RequireAuthorization(Capabilities.ManageTeam);
    }

    private static async Task<IResult> CreateInvitationAsync(
        CreateInvitationRequest request,
        HttpContext httpContext,
        UserManager<ApplicationUser> userManager,
        FgpDbContext database,
        IOrganizationInvitationSender invitationSender,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) ||
            !Enum.TryParse<OrganizationRole>(request.Role, ignoreCase: true, out var role) ||
            role == OrganizationRole.Owner)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["request"] = ["email and a non-Owner role are required."],
            });
        }

        var user = await userManager.GetUserAsync(httpContext.User);
        if (user is null) return Results.Unauthorized();

        var membership = await database.Memberships
            .AsNoTracking()
            .Where(candidate => candidate.UserId == user.Id && candidate.Status == MembershipStatus.Active)
            .OrderBy(candidate => candidate.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (membership is null) return Results.Forbid();

        var email = request.Email.Trim().ToLowerInvariant();
        var token = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var invitation = new OrganizationInvitation
        {
            Id = Guid.NewGuid(),
            OrganizationId = membership.OrganizationId,
            Email = email,
            Role = role,
            InvitedByUserId = user.Id,
            TokenHash = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)),
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7),
            CreatedAt = DateTimeOffset.UtcNow,
        };
        database.OrganizationInvitations.Add(invitation);

        try
        {
            await database.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return Results.Conflict(new ApiError("OpenInvitationExists", "An open invitation already exists for this email."));
        }

        var invitationLink = $"{httpContext.Request.Scheme}://{httpContext.Request.Host}/invitations/{token}";
        await invitationSender.SendInvitationAsync(email, invitationLink);
        return Results.Created($"/api/organizations/invitations/{invitation.Id}",
            new InvitationResponse(invitation.Id, invitation.Email, invitation.Role.ToString(), invitation.ExpiresAt));
    }
}

public sealed record CreateInvitationRequest(string? Email, string? Role);
public sealed record InvitationResponse(Guid Id, string Email, string Role, DateTimeOffset ExpiresAt);
