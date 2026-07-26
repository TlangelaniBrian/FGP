using FGP.Api.Data;
using FGP.Api.CapitalFund;
using FGP.Api.Organizations;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace FGP.Api.Identity;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        var auth = app.MapGroup("/api/auth");
        auth.MapPost("/register", RegisterAsync);
        auth.MapPost("/verify-email", VerifyEmailAsync);
        auth.MapPost("/verification-resend", ResendVerificationAsync);
        auth.MapPost("/sign-in", SignInAsync);
        auth.MapPost("/password-recovery", StartPasswordRecoveryAsync);
        auth.MapPost("/password-reset", ResetPasswordAsync);
        auth.MapPost("/sign-out", SignOutAsync);
        auth.MapGet("/session", GetSessionAsync).RequireAuthorization();
    }

    private static async Task<IResult> RegisterAsync(
        RegisterRequest request,
        HttpContext httpContext,
        IConfiguration configuration,
        UserManager<ApplicationUser> userManager,
        FgpDbContext database,
        GovernanceService governance,
        IEmailSender<ApplicationUser> emailSender,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Password) ||
            string.IsNullOrWhiteSpace(request.DisplayName) ||
            (string.IsNullOrWhiteSpace(request.InvitationToken) && string.IsNullOrWhiteSpace(request.OrganizationName)))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["request"] = ["email, password, displayName, and organizationName are required unless an invitationToken is supplied."],
            });
        }

        var email = request.Email.Trim().ToLowerInvariant();
        OrganizationInvitation? invitation = null;
        if (!string.IsNullOrWhiteSpace(request.InvitationToken))
        {
            var tokenHash = SHA256.HashData(Encoding.UTF8.GetBytes(request.InvitationToken));
            invitation = await database.OrganizationInvitations
                .AsNoTracking()
                .Where(candidate => candidate.TokenHash == tokenHash &&
                                    candidate.AcceptedAt == null &&
                                    candidate.RevokedAt == null &&
                                    candidate.ExpiresAt > DateTimeOffset.UtcNow)
                .SingleOrDefaultAsync(cancellationToken);
            if (invitation is null || !string.Equals(invitation.Email, email, StringComparison.OrdinalIgnoreCase))
            {
                return Results.Json(new ApiError("InvalidInvitation", "The invitation is invalid, expired, or belongs to another email address."), statusCode: StatusCodes.Status400BadRequest);
            }
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            DisplayName = request.DisplayName.Trim(),
        };

        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var createResult = await userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            if (createResult.Errors.Any(error => error.Code is "DuplicateUserName" or "DuplicateEmail"))
            {
                return Results.Json(
                    new ApiError("RegistrationUnavailable", "Unable to create this account."),
                    statusCode: StatusCodes.Status409Conflict);
            }

            return Results.ValidationProblem(createResult.Errors
                .GroupBy(error => error.Code)
                .ToDictionary(group => group.Key, group => group.Select(error => error.Description).ToArray()));
        }

        Guid organizationId;
        OrganizationRole role;
        if (invitation is not null)
        {
            var claimed = await database.OrganizationInvitations
                .Where(candidate => candidate.Id == invitation.Id &&
                                    candidate.AcceptedAt == null &&
                                    candidate.RevokedAt == null &&
                                    candidate.ExpiresAt > DateTimeOffset.UtcNow)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(candidate => candidate.AcceptedAt, DateTimeOffset.UtcNow), cancellationToken);
            if (claimed != 1)
            {
                return Results.Json(new ApiError("InvalidInvitation", "The invitation is no longer available."), statusCode: StatusCodes.Status400BadRequest);
            }

            organizationId = invitation.OrganizationId;
            role = invitation.Role;
        }
        else
        {
            var organization = new Organization
            {
                Id = Guid.NewGuid(),
                Name = request.OrganizationName!.Trim(),
                CreatedAt = DateTimeOffset.UtcNow,
            };
            database.Organizations.Add(organization);
            organizationId = organization.Id;
            role = OrganizationRole.Owner;
        }

        var membership = new Membership
        {
            Id = Guid.NewGuid(),
            OrganizationId = organizationId,
            UserId = user.Id,
            Role = role,
            Status = MembershipStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
            ActivatedAt = DateTimeOffset.UtcNow,
        };
        database.Memberships.Add(membership);
        var membershipEvent = new ActivityEvent
        {
            OrganizationId = organizationId,
            ActorUserId = user.Id,
            ActorName = user.DisplayName,
            EventType = "membership_created",
            Title = "Created organisation membership",
            EntityType = "organization_membership",
            EntityId = membership.Id.ToString(),
            CreatedAt = DateTimeOffset.UtcNow,
        };
        database.ActivityEvents.Add(membershipEvent);
        await database.SaveChangesAsync(cancellationToken);
        await governance.VoidOpenGoalsForMembershipChangeAsync(
            organizationId,
            membershipEvent.Id,
            user.Id,
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var token = await userManager.GenerateEmailConfirmationTokenAsync(user);
        var confirmationLink = BuildIdentityLink(configuration, httpContext.Request, "/verify-email", user.Id, token);
        await emailSender.SendConfirmationLinkAsync(user, email, confirmationLink);

        return Results.Created("/api/auth/session", new { requiresEmailVerification = true });
    }

    private static async Task<IResult> VerifyEmailAsync(
        VerifyEmailRequest request,
        UserManager<ApplicationUser> userManager)
    {
        if (!Guid.TryParse(request.UserId, out var userId) || string.IsNullOrWhiteSpace(request.Token))
        {
            return Results.Json(new ApiError("InvalidVerificationToken", "The confirmation link is invalid."), statusCode: StatusCodes.Status400BadRequest);
        }

        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return Results.Json(new ApiError("InvalidVerificationToken", "The confirmation link is invalid."), statusCode: StatusCodes.Status400BadRequest);
        }

        var result = await userManager.ConfirmEmailAsync(user, request.Token);
        return result.Succeeded
            ? Results.NoContent()
            : Results.Json(new ApiError("InvalidVerificationToken", "The confirmation link is invalid or expired."), statusCode: StatusCodes.Status400BadRequest);
    }

    private static async Task<IResult> ResendVerificationAsync(
        VerificationResendRequest request,
        HttpContext httpContext,
        IConfiguration configuration,
        UserManager<ApplicationUser> userManager,
        IEmailSender<ApplicationUser> emailSender)
    {
        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var user = await userManager.FindByEmailAsync(request.Email.Trim());
            if (user is { EmailConfirmed: false, Email: not null })
            {
                var token = await userManager.GenerateEmailConfirmationTokenAsync(user);
                var confirmationLink = BuildIdentityLink(configuration, httpContext.Request, "/verify-email", user.Id, token);
                await emailSender.SendConfirmationLinkAsync(user, user.Email, confirmationLink);
            }
        }

        return Results.NoContent();
    }

    private static async Task<IResult> SignInAsync(
        SignInRequest request,
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        FgpDbContext database)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return Results.Json(new ApiError("InvalidCredentials", "Email and password are required."), statusCode: StatusCodes.Status401Unauthorized);
        }

        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null)
        {
            return Results.Json(new ApiError("InvalidCredentials", "The email or password is incorrect."), statusCode: StatusCodes.Status401Unauthorized);
        }

        if (!user.EmailConfirmed)
        {
            return Results.Json(new ApiError("EmailUnverified", "Confirm your email before signing in."), statusCode: StatusCodes.Status403Forbidden);
        }

        var membership = await database.Memberships
            .Where(candidate => candidate.UserId == user.Id && candidate.Status == MembershipStatus.Active)
            .OrderBy(candidate => candidate.CreatedAt)
            .FirstOrDefaultAsync();
        if (membership is null)
        {
            return Results.Json(new ApiError("NoActiveOrganization", "No active organisation membership is available."), statusCode: StatusCodes.Status403Forbidden);
        }

        var signIn = await signInManager.PasswordSignInAsync(
            user,
            request.Password,
            isPersistent: false,
            lockoutOnFailure: true);
        if (!signIn.Succeeded)
        {
            return Results.Json(new ApiError("InvalidCredentials", "The email or password is incorrect."), statusCode: StatusCodes.Status401Unauthorized);
        }

        return Results.NoContent();
    }

    private static async Task<IResult> StartPasswordRecoveryAsync(
        PasswordRecoveryRequest request,
        HttpContext httpContext,
        IConfiguration configuration,
        UserManager<ApplicationUser> userManager,
        IEmailSender<ApplicationUser> emailSender)
    {
        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var user = await userManager.FindByEmailAsync(request.Email.Trim());
            if (user is { EmailConfirmed: true, Email: not null })
            {
                var token = await userManager.GeneratePasswordResetTokenAsync(user);
                var resetLink = BuildIdentityLink(configuration, httpContext.Request, "/password-reset", user.Id, token);
                await emailSender.SendPasswordResetLinkAsync(user, user.Email, resetLink);
            }
        }

        return Results.NoContent();
    }

    private static async Task<IResult> ResetPasswordAsync(
        PasswordResetRequest request,
        UserManager<ApplicationUser> userManager)
    {
        if (!Guid.TryParse(request.UserId, out var userId) ||
            string.IsNullOrWhiteSpace(request.Token) ||
            string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return Results.Json(new ApiError("InvalidResetToken", "The password reset request is invalid."), statusCode: StatusCodes.Status400BadRequest);
        }

        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return Results.Json(new ApiError("InvalidResetToken", "The password reset request is invalid."), statusCode: StatusCodes.Status400BadRequest);
        }

        var result = await userManager.ResetPasswordAsync(user, request.Token, request.NewPassword);
        return result.Succeeded
            ? Results.NoContent()
            : Results.Json(new ApiError("InvalidResetToken", "The password reset request is invalid or expired."), statusCode: StatusCodes.Status400BadRequest);
    }

    private static async Task<IResult> SignOutAsync(SignInManager<ApplicationUser> signInManager)
    {
        await signInManager.SignOutAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> GetSessionAsync(
        HttpContext httpContext,
        UserManager<ApplicationUser> userManager,
        FgpDbContext database)
    {
        var user = await userManager.GetUserAsync(httpContext.User);
        if (user is null)
        {
            return Results.Unauthorized();
        }

        var organizationClaim = httpContext.User.FindFirstValue("organization_id");
        if (!Guid.TryParse(organizationClaim, out var organizationId))
        {
            return Results.Unauthorized();
        }

        var membership = await database.Memberships
            .Where(candidate =>
                candidate.UserId == user.Id &&
                candidate.OrganizationId == organizationId &&
                candidate.Status == MembershipStatus.Active)
            .Join(database.Organizations,
                membership => membership.OrganizationId,
                organization => organization.Id,
                (membership, organization) => new { membership, organization })
            .SingleOrDefaultAsync();
        if (membership is null)
        {
            return Results.Json(new ApiError("NoActiveOrganization", "No active organisation membership is available."), statusCode: StatusCodes.Status403Forbidden);
        }

        return Results.Ok(new AuthSession(
            membership.membership.Id,
            new AuthSessionUser(user.Id, user.Email!, user.DisplayName ?? user.UserName!),
            new AuthSessionOrganization(membership.organization.Id, membership.organization.Name, membership.membership.Role.ToString()),
            CapabilityPolicy.For(membership.membership.Role).OrderBy(capability => capability).ToArray()));
    }

    private static string BuildIdentityLink(
        IConfiguration configuration,
        HttpRequest request,
        string path,
        Guid userId,
        string token)
    {
        var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
        return WebLinkBuilder.Build(
            configuration,
            request,
            path,
            new Dictionary<string, string?>
            {
                ["userId"] = userId.ToString(),
                ["token"] = encodedToken,
            });
    }
}

public sealed record RegisterRequest(string? Email, string? Password, string? DisplayName, string? OrganizationName, string? InvitationToken = null);
public sealed record VerifyEmailRequest(string? UserId, string? Token);
public sealed record VerificationResendRequest(string? Email);
public sealed record SignInRequest(string? Email, string? Password);
public sealed record PasswordRecoveryRequest(string? Email);
public sealed record PasswordResetRequest(string? UserId, string? Token, string? NewPassword);
public sealed record ApiError(string Code, string Message);
public sealed record AuthSession(Guid MembershipId, AuthSessionUser User, AuthSessionOrganization ActiveOrganization, string[] Capabilities);
public sealed record AuthSessionUser(Guid Id, string Email, string DisplayName);
public sealed record AuthSessionOrganization(Guid Id, string Name, string Role);
