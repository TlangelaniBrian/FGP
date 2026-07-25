using FGP.Api.Data;
using FGP.Api.Organizations;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text;

namespace FGP.Api.Identity;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        var auth = app.MapGroup("/api/auth");
        auth.MapPost("/register", RegisterAsync);
        auth.MapPost("/verify-email", VerifyEmailAsync);
        auth.MapPost("/sign-in", SignInAsync);
        auth.MapPost("/password-recovery", StartPasswordRecoveryAsync);
        auth.MapPost("/password-reset", ResetPasswordAsync);
        auth.MapPost("/sign-out", SignOutAsync);
        auth.MapGet("/session", GetSessionAsync).RequireAuthorization();
    }

    private static async Task<IResult> RegisterAsync(
        RegisterRequest request,
        HttpContext httpContext,
        UserManager<ApplicationUser> userManager,
        FgpDbContext database,
        IEmailSender<ApplicationUser> emailSender,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Password) ||
            string.IsNullOrWhiteSpace(request.DisplayName) ||
            string.IsNullOrWhiteSpace(request.OrganizationName))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["request"] = ["email, password, displayName, and organizationName are required."],
            });
        }

        var email = request.Email.Trim().ToLowerInvariant();
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
            return Results.ValidationProblem(createResult.Errors
                .GroupBy(error => error.Code)
                .ToDictionary(group => group.Key, group => group.Select(error => error.Description).ToArray()));
        }

        var organization = new Organization
        {
            Id = Guid.NewGuid(),
            Name = request.OrganizationName.Trim(),
            CreatedAt = DateTimeOffset.UtcNow,
        };
        database.Organizations.Add(organization);
        database.Memberships.Add(new Membership
        {
            Id = Guid.NewGuid(),
            OrganizationId = organization.Id,
            UserId = user.Id,
            Role = OrganizationRole.Owner,
            Status = MembershipStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
            ActivatedAt = DateTimeOffset.UtcNow,
        });
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var token = await userManager.GenerateEmailConfirmationTokenAsync(user);
        var confirmationLink = $"{httpContext.Request.Scheme}://{httpContext.Request.Host}/api/auth/verify-email?userId={user.Id}&token={WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token))}";
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
        if (user is null || !await userManager.CheckPasswordAsync(user, request.Password))
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

        await signInManager.SignInWithClaimsAsync(user, isPersistent: false,
        [
            new Claim("organization_id", membership.OrganizationId.ToString()),
            new Claim(ClaimTypes.Role, membership.Role.ToString()),
        ]);
        return Results.NoContent();
    }

    private static async Task<IResult> StartPasswordRecoveryAsync(
        PasswordRecoveryRequest request,
        HttpContext httpContext,
        UserManager<ApplicationUser> userManager,
        IEmailSender<ApplicationUser> emailSender)
    {
        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var user = await userManager.FindByEmailAsync(request.Email.Trim());
            if (user is { EmailConfirmed: true, Email: not null })
            {
                var token = await userManager.GeneratePasswordResetTokenAsync(user);
                var resetLink = $"{httpContext.Request.Scheme}://{httpContext.Request.Host}/api/auth/password-reset?userId={user.Id}&token={WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token))}";
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

        var membership = await database.Memberships
            .Where(candidate => candidate.UserId == user.Id && candidate.Status == MembershipStatus.Active)
            .Join(database.Organizations,
                membership => membership.OrganizationId,
                organization => organization.Id,
                (membership, organization) => new { membership, organization })
            .OrderBy(candidate => candidate.membership.CreatedAt)
            .FirstOrDefaultAsync();
        if (membership is null)
        {
            return Results.Json(new ApiError("NoActiveOrganization", "No active organisation membership is available."), statusCode: StatusCodes.Status403Forbidden);
        }

        return Results.Ok(new AuthSession(
            new AuthSessionUser(user.Id, user.Email!, user.DisplayName ?? user.UserName!),
            new AuthSessionOrganization(membership.organization.Id, membership.organization.Name, membership.membership.Role.ToString()),
            CapabilityPolicy.For(membership.membership.Role).OrderBy(capability => capability).ToArray()));
    }
}

public sealed record RegisterRequest(string? Email, string? Password, string? DisplayName, string? OrganizationName);
public sealed record VerifyEmailRequest(string? UserId, string? Token);
public sealed record SignInRequest(string? Email, string? Password);
public sealed record PasswordRecoveryRequest(string? Email);
public sealed record PasswordResetRequest(string? UserId, string? Token, string? NewPassword);
public sealed record ApiError(string Code, string Message);
public sealed record AuthSession(AuthSessionUser User, AuthSessionOrganization ActiveOrganization, string[] Capabilities);
public sealed record AuthSessionUser(Guid Id, string Email, string DisplayName);
public sealed record AuthSessionOrganization(Guid Id, string Name, string Role);
