using FGP.Api.Data;
using FGP.Api.Identity;
using FGP.Api.Organizations;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FGP.Api.CapitalFund;

public static class CapitalFundEndpoints
{
    public static void MapCapitalFundEndpoints(this WebApplication app)
    {
        app.MapPost("/api/capital/contributions", RecordContributionAsync).RequireAuthorization(Capabilities.RecordContribution);
    }

    private static async Task<IResult> RecordContributionAsync(RecordContributionRequest request, HttpContext context, UserManager<ApplicationUser> users, FgpDbContext database, CancellationToken cancellationToken)
    {
        if (request.Amount <= 0 || request.ContributionDate == default) return Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = ["A positive amount and contribution date are required."] });
        var user = await users.GetUserAsync(context.User);
        if (user is null) return Results.Unauthorized();
        var actor = await database.Memberships.SingleOrDefaultAsync(member => member.UserId == user.Id && member.Status == MembershipStatus.Active, cancellationToken);
        if (actor is null) return Results.Forbid();
        var subject = await database.Memberships.SingleOrDefaultAsync(member => member.Id == request.MemberId && member.OrganizationId == actor.OrganizationId && member.Status == MembershipStatus.Active, cancellationToken);
        if (subject is null) return Results.NotFound();
        var contribution = new CapitalContribution { OrganizationId = actor.OrganizationId, MemberId = subject.Id, RecordedByUserId = user.Id, Amount = request.Amount, ContributionDate = request.ContributionDate, Note = request.Note?.Trim(), CreatedAt = DateTimeOffset.UtcNow };
        database.CapitalContributions.Add(contribution);
        database.ActivityEvents.Add(new ActivityEvent { OrganizationId = actor.OrganizationId, ActorUserId = user.Id, ActorName = user.DisplayName, EventType = "capital_contribution_recorded", Title = "Recorded contribution", Detail = request.Amount.ToString("0.00"), EntityType = "capital_contribution", CreatedAt = DateTimeOffset.UtcNow });
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/capital/contributions/{contribution.Id}", new { contribution.Id });
    }
}

public sealed record RecordContributionRequest(Guid MemberId, decimal Amount, DateOnly ContributionDate, string? Note);
