using FGP.Api.Data;
using FGP.Api.CapitalFund;
using FGP.Api.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Security.Cryptography;

namespace FGP.Api.Organizations;

public static class OrganizationEndpoints
{
    public static void MapOrganizationEndpoints(this WebApplication app)
    {
        var organizations = app.MapGroup("/api/organizations");
        organizations.MapPost("/invitations", CreateInvitationAsync).RequireAuthorization(Capabilities.ManageTeam);
        organizations.MapGet("/members", ListMembersAsync).RequireAuthorization();
        organizations.MapGet("/members/{membershipId:guid}", GetMemberAsync).RequireAuthorization();
        organizations.MapPatch("/members/{membershipId:guid}", UpdateMemberAsync).RequireAuthorization(Capabilities.ManageTeam);
        organizations.MapPost("/members/{membershipId:guid}/transfer-ownership", TransferOwnershipAsync).RequireAuthorization(Capabilities.ManageTeam);
    }

    private static async Task<IResult> CreateInvitationAsync(
        CreateInvitationRequest request,
        HttpContext httpContext,
        IConfiguration configuration,
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

        var actor = await ResolveActorAsync(httpContext, userManager, database, cancellationToken);
        if (actor is null) return Results.Forbid();

        var email = request.Email.Trim().ToLowerInvariant();
        var token = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var invitation = new OrganizationInvitation
        {
            Id = Guid.NewGuid(),
            OrganizationId = actor.Membership.OrganizationId,
            Email = email,
            Role = role,
            InvitedByUserId = actor.User.Id,
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

        var invitationLink = WebLinkBuilder.Build(
            configuration,
            httpContext.Request,
            $"/invitations/{token}");
        await invitationSender.SendInvitationAsync(email, invitationLink);
        return Results.Created($"/api/organizations/invitations/{invitation.Id}",
            new InvitationResponse(invitation.Id, invitation.Email, invitation.Role.ToString(), invitation.ExpiresAt));
    }

    private static async Task<IResult> ListMembersAsync(
        HttpContext httpContext,
        UserManager<ApplicationUser> userManager,
        FgpDbContext database,
        CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(httpContext, userManager, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();

        var members = await database.Memberships
            .AsNoTracking()
            .Where(member => member.OrganizationId == actor.Membership.OrganizationId)
            .Join(database.Users.AsNoTracking(),
                membership => membership.UserId,
                user => user.Id,
                (membership, user) => new { membership, user })
            .OrderBy(item => item.user.Email)
            .Select(item => new MemberResponse(
                item.membership.Id,
                item.membership.UserId,
                item.user.Email!,
                item.user.DisplayName,
                item.membership.Role.ToString(),
                item.membership.Status.ToString()))
            .ToListAsync(cancellationToken);        return Results.Ok(members);
    }

    private static async Task<IResult> GetMemberAsync(
        Guid membershipId,
        HttpContext httpContext,
        UserManager<ApplicationUser> userManager,
        FgpDbContext database,
        CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(httpContext, userManager, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();

        var member = await database.Memberships
            .AsNoTracking()
            .SingleOrDefaultAsync(candidate =>
                candidate.Id == membershipId &&
                candidate.OrganizationId == actor.Membership.OrganizationId,
                cancellationToken);
        return member is null
            ? Results.NotFound()
            : Results.Ok(await ToResponseAsync(database, member, cancellationToken));
    }

    private static async Task<IResult> UpdateMemberAsync(
        Guid membershipId,
        UpdateMemberRequest request,
        HttpContext httpContext,
        UserManager<ApplicationUser> userManager,
        FgpDbContext database,
        GovernanceService governance,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Role) && string.IsNullOrWhiteSpace(request.Status))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = ["role or status is required."] });
        }

        OrganizationRole? nextRole = null;
        if (!string.IsNullOrWhiteSpace(request.Role) &&
            (!Enum.TryParse<OrganizationRole>(request.Role, true, out var parsedRole) || parsedRole == OrganizationRole.Owner))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["role"] = ["Use ownership transfer to assign Owner; other roles must be valid."] });
        }
        else if (!string.IsNullOrWhiteSpace(request.Role))
        {
            nextRole = Enum.Parse<OrganizationRole>(request.Role, true);
        }

        MembershipStatus? nextStatus = null;
        if (!string.IsNullOrWhiteSpace(request.Status) && !Enum.TryParse<MembershipStatus>(request.Status, true, out var parsedStatus))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["status"] = ["status must be Invited, Active, Suspended, or Removed."] });
        }
        else if (!string.IsNullOrWhiteSpace(request.Status))
        {
            nextStatus = Enum.Parse<MembershipStatus>(request.Status, true);
        }

        var actor = await ResolveActorAsync(httpContext, userManager, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();

        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var target = await database.Memberships.SingleOrDefaultAsync(member => member.Id == membershipId && member.OrganizationId == actor.Membership.OrganizationId, cancellationToken);
        if (target is null) return Results.NotFound();
        if (target.Role == OrganizationRole.Owner)
        {
            return Results.Conflict(new ApiError("OwnershipTransferRequired", "Transfer ownership before changing the active Owner."));
        }
        if (target.UserId == actor.User.Id && nextStatus is { } status && status != MembershipStatus.Active)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["status"] = ["You cannot remove or suspend your own workspace access."] });
        }

        var memberships = await database.Memberships
            .Where(member => member.OrganizationId == actor.Membership.OrganizationId)
            .ToListAsync(cancellationToken);
        target.Role = nextRole ?? target.Role;
        target.Status = nextStatus ?? target.Status;
        if (!OrganizationMembershipRules.HasValidActiveLeadership(memberships.Select(member => new MembershipState(member.UserId, member.Role, member.Status))))
        {
            return Results.Conflict(new ApiError("LeadershipInvariant", "The organization must retain exactly one active Owner and at most one active Chairperson."));
        }

        var membershipEvent = AddMembershipActivity(database, actor, target, "team_update", "Updated team member");
        await database.SaveChangesAsync(cancellationToken);
        await governance.VoidOpenGoalsForMembershipChangeAsync(
            actor.Membership.OrganizationId,
            membershipEvent.Id,
            actor.User.Id,
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(await ToResponseAsync(database, target, cancellationToken));
    }

    private static async Task<IResult> TransferOwnershipAsync(
        Guid membershipId,
        TransferOwnershipRequest request,
        HttpContext httpContext,
        UserManager<ApplicationUser> userManager,
        FgpDbContext database,
        GovernanceService governance,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<OrganizationRole>(request.PreviousOwnerRole, true, out var previousOwnerRole) || previousOwnerRole == OrganizationRole.Owner)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["previousOwnerRole"] = ["A valid non-Owner role is required."] });
        }

        var actor = await ResolveActorAsync(httpContext, userManager, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();
        if (actor.Membership.Role != OrganizationRole.Owner) return Results.Forbid();

        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var target = await database.Memberships.SingleOrDefaultAsync(member => member.Id == membershipId && member.OrganizationId == actor.Membership.OrganizationId, cancellationToken);
        if (target is null) return Results.NotFound();
        if (target.Id == actor.Membership.Id || target.Status != MembershipStatus.Active)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["membershipId"] = ["Ownership can only transfer to another active member."] });
        }

        var memberships = await database.Memberships
            .Where(member => member.OrganizationId == actor.Membership.OrganizationId)
            .ToListAsync(cancellationToken);
        var currentOwner = memberships.Single(member => member.Id == actor.Membership.Id);
        currentOwner.Role = previousOwnerRole;
        target.Role = OrganizationRole.Owner;
        if (!OrganizationMembershipRules.HasValidActiveLeadership(memberships.Select(member => new MembershipState(member.UserId, member.Role, member.Status))))
        {
            return Results.Conflict(new ApiError("LeadershipInvariant", "The requested transfer would create an invalid leadership configuration."));
        }

        database.Entry(currentOwner).State = EntityState.Detached;
        database.Entry(target).State = EntityState.Detached;
        await database.Memberships.Where(member => member.Id == currentOwner.Id)
            .ExecuteUpdateAsync(setters => setters.SetProperty(member => member.Role, previousOwnerRole), cancellationToken);
        await database.Memberships.Where(member => member.Id == membershipId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(member => member.Role, OrganizationRole.Owner), cancellationToken);
        var membershipEvent = AddMembershipActivity(database, actor, target, "team_ownership_transfer", "Transferred ownership");
        await database.SaveChangesAsync(cancellationToken);
        await governance.VoidOpenGoalsForMembershipChangeAsync(
            actor.Membership.OrganizationId,
            membershipEvent.Id,
            actor.User.Id,
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(await ToResponseAsync(database, target, cancellationToken));
    }

    private static async Task<OrganizationActor?> ResolveActorAsync(
        HttpContext httpContext,
        UserManager<ApplicationUser> userManager,
        FgpDbContext database,
        CancellationToken cancellationToken)
    {
        var user = await userManager.GetUserAsync(httpContext.User);
        if (user is null) return null;

        var organizationClaim = httpContext.User.FindFirstValue("organization_id");
        if (!Guid.TryParse(organizationClaim, out var organizationId)) return null;

        var membership = await database.Memberships
            .AsNoTracking()
            .SingleOrDefaultAsync(candidate =>
                candidate.UserId == user.Id &&
                candidate.OrganizationId == organizationId &&
                candidate.Status == MembershipStatus.Active,
                cancellationToken);
        return membership is null ? null : new OrganizationActor(user, membership);
    }

    private static ActivityEvent AddMembershipActivity(FgpDbContext database, OrganizationActor actor, Membership member, string eventType, string title)
    {
        var activity = new ActivityEvent
        {
            OrganizationId = actor.Membership.OrganizationId,
            ActorUserId = actor.User.Id,
            ActorName = actor.User.DisplayName,
            EventType = eventType,
            Title = title,
            Detail = $"{member.Role} · {member.Status}",
            EntityType = "organization_membership",
            EntityId = member.Id.ToString(),
            CreatedAt = DateTimeOffset.UtcNow,
        };
        database.ActivityEvents.Add(activity);
        return activity;
    }

    private static async Task<MemberResponse> ToResponseAsync(FgpDbContext database, Membership member, CancellationToken cancellationToken)
    {
        var user = await database.Users
            .AsNoTracking()
            .SingleAsync(candidate => candidate.Id == member.UserId, cancellationToken);
        return new MemberResponse(member.Id, member.UserId, user.Email ?? string.Empty, user.DisplayName, member.Role.ToString(), member.Status.ToString());
    }
}

public sealed record CreateInvitationRequest(string? Email, string? Role);
public sealed record InvitationResponse(Guid Id, string Email, string Role, DateTimeOffset ExpiresAt);
public sealed record UpdateMemberRequest(string? Role, string? Status);
public sealed record TransferOwnershipRequest(string? PreviousOwnerRole);
public sealed record MemberResponse(Guid Id, Guid UserId, string Email, string? DisplayName, string Role, string Status);
internal sealed record OrganizationActor(ApplicationUser User, Membership Membership);
