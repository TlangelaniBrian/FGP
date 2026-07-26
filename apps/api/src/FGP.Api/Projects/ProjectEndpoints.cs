using FGP.Api.Data;
using FGP.Api.Data.Entities;
using FGP.Api.Identity;
using FGP.Api.Organizations;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Security.Claims;

namespace FGP.Api.Projects;

public static class ProjectEndpoints
{
    private const int DefaultLimit = 50;
    private const int MaximumLimit = 200;

    private static readonly HashSet<string> AllowedStatuses =
    [
        "planning",
        "compliance",
        "approved",
        "construction",
        "complete",
        "stalled",
    ];

    public static void MapProjectEndpoints(this WebApplication app)
    {
        var projects = app.MapGroup("/api/projects").RequireAuthorization();
        projects.MapGet("/", ListProjectsAsync);
        projects.MapPost("/", CreateProjectAsync).RequireAuthorization(Capabilities.RecordContribution);
        projects.MapGet("/{id}", GetProjectAsync);
        projects.MapPatch("/{id}", UpdateProjectAsync).RequireAuthorization(Capabilities.RecordContribution);
    }

    private static async Task<IResult> ListProjectsAsync(
        HttpContext httpContext,
        FgpDbContext database,
        CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(httpContext, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();

        var hasPagination = httpContext.Request.Query.ContainsKey("limit") ||
                            httpContext.Request.Query.ContainsKey("offset");
        var limit = ParseBoundedInteger(
            httpContext.Request.Query["limit"].FirstOrDefault(),
            DefaultLimit,
            1,
            MaximumLimit);
        var offset = ParseBoundedInteger(
            httpContext.Request.Query["offset"].FirstOrDefault(),
            0,
            0,
            int.MaxValue);

        var query = database.Projects
            .AsNoTracking()
            .Where(project => project.OrganizationId == actor.OrganizationId);
        var rows = await query
            .OrderByDescending(project => project.CreatedAt)
            .Skip(offset)
            .Take(limit)
            .ToListAsync(cancellationToken);
        var response = rows.Select(ToResponse).ToArray();

        if (!hasPagination)
        {
            return Results.Ok(response);
        }

        var total = await query.CountAsync(cancellationToken);
        return Results.Ok(new ProjectListResponse(response, total, limit, offset));
    }

    private static async Task<IResult> GetProjectAsync(
        string id,
        HttpContext httpContext,
        FgpDbContext database,
        CancellationToken cancellationToken)
    {
        if (!long.TryParse(id, NumberStyles.None, CultureInfo.InvariantCulture, out var projectId))
        {
            return Results.Json(new { error = "invalid id" }, statusCode: StatusCodes.Status400BadRequest);
        }

        var actor = await ResolveActorAsync(httpContext, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();

        var project = await database.Projects
            .AsNoTracking()
            .SingleOrDefaultAsync(
                candidate =>
                    candidate.Id == projectId &&
                    candidate.OrganizationId == actor.OrganizationId,
                cancellationToken);
        if (project is null)
        {
            return ProjectNotFound();
        }

        var budget = await database.ProjectBudgetItems
            .AsNoTracking()
            .Where(item =>
                item.ProjectId == projectId &&
                item.OrganizationId == actor.OrganizationId)
            .ToListAsync(cancellationToken);
        var contacts = await database.ProjectContacts
            .AsNoTracking()
            .Where(contact =>
                contact.ProjectId == projectId &&
                contact.OrganizationId == actor.OrganizationId)
            .ToListAsync(cancellationToken);
        var decisions = await database.ProjectDecisions
            .AsNoTracking()
            .Where(decision =>
                decision.ProjectId == projectId &&
                decision.OrganizationId == actor.OrganizationId)
            .OrderByDescending(decision => decision.DecidedAt)
            .ToListAsync(cancellationToken);
        var milestones = await database.Milestones
            .AsNoTracking()
            .Where(milestone =>
                milestone.ProjectId == projectId &&
                milestone.OrganizationId == actor.OrganizationId)
            .ToListAsync(cancellationToken);
        var latestCheckin = await database.ProjectCheckins
            .AsNoTracking()
            .Where(checkin =>
                checkin.ProjectId == projectId &&
                checkin.OrganizationId == actor.OrganizationId)
            .OrderByDescending(checkin => checkin.WeekOf)
            .FirstOrDefaultAsync(cancellationToken);
        var savedToDate = await database.ProjectCheckins
            .AsNoTracking()
            .Where(checkin =>
                checkin.ProjectId == projectId &&
                checkin.OrganizationId == actor.OrganizationId)
            .SumAsync(checkin => checkin.DepositZar ?? 0m, cancellationToken);

        return Results.Ok(new ProjectDetailResponse(
            ToResponse(project),
            budget.Select(ToResponse).ToArray(),
            contacts.Select(ToResponse).ToArray(),
            decisions.Select(ToResponse).ToArray(),
            milestones.Select(ToResponse).ToArray(),
            latestCheckin is null ? null : ToResponse(latestCheckin),
            savedToDate));
    }

    private static async Task<IResult> CreateProjectAsync(
        CreateProjectRequest request,
        HttpContext httpContext,
        FgpDbContext database,
        CancellationToken cancellationToken)
    {
        var validationError = Validate(request);
        if (validationError is not null)
        {
            return Results.Json(new { error = validationError }, statusCode: StatusCodes.Status422UnprocessableEntity);
        }

        var actor = await ResolveActorAsync(httpContext, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();

        var listingExists = await database.Listings
            .AsNoTracking()
            .AnyAsync(
                listing =>
                    listing.Id == request.ListingId &&
                    listing.OrganizationId == actor.OrganizationId,
                cancellationToken);
        var reportExists = await database.FeasibilityReports
            .AsNoTracking()
            .AnyAsync(
                report =>
                    report.Id == request.ReportId &&
                    report.OrganizationId == actor.OrganizationId,
                cancellationToken);
        if (!listingExists || !reportExists)
        {
            return Results.Json(
                new { error = "listing or feasibility report not found" },
                statusCode: StatusCodes.Status404NotFound);
        }

        var now = DateTimeOffset.UtcNow;
        var project = new Project
        {
            OrganizationId = actor.OrganizationId,
            UserId = actor.UserId,
            ListingId = request.ListingId,
            ReportId = request.ReportId,
            Name = request.Name,
            Status = request.Status ?? "planning",
            Notes = request.Notes,
            Phase1TargetZar = request.Phase1TargetZar,
            MonthlySavingZar = request.MonthlySavingZar,
            CreatedAt = now,
            UpdatedAt = now,
        };

        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        database.Projects.Add(project);
        await database.SaveChangesAsync(cancellationToken);
        database.ActivityEvents.Add(new ActivityEvent
        {
            OrganizationId = actor.OrganizationId,
            ActorUserId = actor.UserId,
            ActorName = actor.Name,
            EventType = "project_created",
            Title = $"Project created: {project.Name}",
            EntityType = "project",
            EntityId = project.Id.ToString(CultureInfo.InvariantCulture),
            CreatedAt = now,
        });
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Results.Created($"/api/projects/{project.Id}", ToResponse(project));
    }

    private static async Task<IResult> UpdateProjectAsync(
        string id,
        UpdateProjectRequest request,
        HttpContext httpContext,
        FgpDbContext database,
        CancellationToken cancellationToken)
    {
        if (!long.TryParse(id, NumberStyles.None, CultureInfo.InvariantCulture, out var projectId))
        {
            return Results.Json(new { error = "invalid id" }, statusCode: StatusCodes.Status400BadRequest);
        }
        if (request.Status is not null && !AllowedStatuses.Contains(request.Status))
        {
            return Results.Json(new { error = "invalid status" }, statusCode: StatusCodes.Status422UnprocessableEntity);
        }

        var actor = await ResolveActorAsync(httpContext, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();

        var project = await database.Projects.SingleOrDefaultAsync(
            candidate =>
                candidate.Id == projectId &&
                candidate.OrganizationId == actor.OrganizationId,
            cancellationToken);
        if (project is null)
        {
            return ProjectNotFound();
        }

        project.Name = request.Name ?? project.Name;
        project.Status = request.Status ?? project.Status;
        project.Notes = request.Notes ?? project.Notes;
        project.MonthlySavingZar = request.MonthlySavingZar ?? project.MonthlySavingZar;
        project.Phase1TargetZar = request.Phase1TargetZar ?? project.Phase1TargetZar;
        project.UpdatedAt = DateTimeOffset.UtcNow;
        database.ActivityEvents.Add(new ActivityEvent
        {
            OrganizationId = actor.OrganizationId,
            ActorUserId = actor.UserId,
            ActorName = actor.Name,
            EventType = "project_updated",
            Title = $"Project updated: {project.Name}",
            Detail = project.Status,
            EntityType = "project",
            EntityId = project.Id.ToString(CultureInfo.InvariantCulture),
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await database.SaveChangesAsync(cancellationToken);

        return Results.Ok(ToResponse(project));
    }

    private static string? Validate(CreateProjectRequest request)
    {
        if (request.ListingId <= 0 || request.ReportId <= 0)
        {
            return "listingId and reportId must be positive integers";
        }
        if (request.Name is null || request.Name.Length is < 2 or > 120)
        {
            return "name must contain between 2 and 120 characters";
        }
        if (request.Status is not null && !AllowedStatuses.Contains(request.Status))
        {
            return "invalid status";
        }
        if (request.Notes?.Length > 5000)
        {
            return "notes must contain no more than 5000 characters";
        }
        if (request.Phase1TargetZar < 0 || request.MonthlySavingZar < 0)
        {
            return "financial targets cannot be negative";
        }

        return null;
    }

    internal static async Task<ProjectActor?> ResolveActorAsync(
        HttpContext httpContext,
        FgpDbContext database,
        CancellationToken cancellationToken)
    {
        var userClaim = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
        var organizationClaim = httpContext.User.FindFirstValue("organization_id");
        if (!Guid.TryParse(userClaim, out var userId) ||
            !Guid.TryParse(organizationClaim, out var organizationId))
        {
            return null;
        }

        var hasMembership = await database.Memberships
            .AsNoTracking()
            .AnyAsync(
                membership =>
                    membership.UserId == userId &&
                    membership.OrganizationId == organizationId &&
                    membership.Status == MembershipStatus.Active,
                cancellationToken);
        if (!hasMembership)
        {
            return null;
        }

        var name = await database.Users
            .AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => user.DisplayName ?? user.UserName ?? string.Empty)
            .SingleAsync(cancellationToken);
        return new ProjectActor(userId, organizationId, name);
    }

    private static IResult ProjectNotFound() =>
        Results.Json(new { error = "not found" }, statusCode: StatusCodes.Status404NotFound);

    private static int ParseBoundedInteger(string? value, int fallback, int minimum, int maximum)
    {
        if (!int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
        {
            return fallback;
        }

        return Math.Clamp(parsed, minimum, maximum);
    }

    private static ProjectResponse ToResponse(Project project) =>
        new(
            project.Id,
            project.UserId,
            project.ListingId,
            project.ReportId,
            project.Name,
            project.Status,
            project.Notes,
            project.ErfNumber,
            project.Township,
            project.Partners,
            FormatDecimal(project.MonthlySavingZar),
            FormatDecimal(project.Phase1TargetZar),
            project.Scenario,
            project.CreatedAt,
            project.UpdatedAt);

    private static ProjectBudgetItemResponse ToResponse(ProjectBudgetItem item) =>
        new(
            item.Id,
            item.ProjectId,
            item.Category,
            item.Item,
            item.Description,
            item.Unit,
            FormatDecimal(item.Quantity),
            FormatDecimal(item.UnitCost),
            FormatDecimal(item.TotalCost),
            FormatDecimal(item.ActualCost),
            item.Status,
            item.Timeline,
            item.Notes,
            item.CreatedAt);

    private static ProjectContactResponse ToResponse(ProjectContact contact) =>
        new(
            contact.Id,
            contact.ProjectId,
            contact.Role,
            contact.Name,
            contact.Phone,
            contact.Email,
            contact.Status,
            contact.Notes);

    private static ProjectDecisionResponse ToResponse(ProjectDecision decision) =>
        new(
            decision.Id,
            decision.ProjectId,
            decision.DecidedAt,
            decision.Decision,
            decision.Rationale,
            decision.Impact,
            decision.CreatedAt);

    internal static ProjectCheckinResponse ToResponse(ProjectCheckin checkin) =>
        new(
            checkin.Id,
            checkin.ProjectId,
            checkin.WeekOf,
            checkin.AttorneyStatus,
            checkin.SavingsConfirmed,
            FormatDecimal(checkin.DepositZar),
            checkin.SupplierProgress,
            checkin.OpenIssues,
            checkin.ActionsNextCall,
            checkin.DecisionsNeeded,
            checkin.CreatedAt);

    private static MilestoneResponse ToResponse(Milestone milestone) =>
        new(
            milestone.Id,
            milestone.ProjectId,
            milestone.TargetDate,
            milestone.Name,
            milestone.Status,
            milestone.Owner,
            milestone.IsMajor,
            milestone.CreatedAt);

    private static string? FormatDecimal(decimal? value) =>
        value?.ToString(CultureInfo.InvariantCulture);
}

public sealed record CreateProjectRequest(
    long ListingId,
    long ReportId,
    string? Name,
    string? Status = null,
    string? Notes = null,
    decimal? Phase1TargetZar = null,
    decimal? MonthlySavingZar = null);

public sealed record UpdateProjectRequest(
    string? Name = null,
    string? Status = null,
    string? Notes = null,
    decimal? MonthlySavingZar = null,
    decimal? Phase1TargetZar = null);

public sealed record ProjectResponse(
    long Id,
    Guid? UserId,
    long? ListingId,
    long? ReportId,
    string? Name,
    string Status,
    string? Notes,
    string? ErfNumber,
    string? Township,
    string[]? Partners,
    string? MonthlySavingZar,
    string? Phase1TargetZar,
    string Scenario,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ProjectListResponse(
    ProjectResponse[] Projects,
    int Total,
    int Limit,
    int Offset);

public sealed record ProjectDetailResponse(
    ProjectResponse Project,
    ProjectBudgetItemResponse[] Budget,
    ProjectContactResponse[] Contacts,
    ProjectDecisionResponse[] Decisions,
    MilestoneResponse[] Milestones,
    ProjectCheckinResponse? LatestCheckin,
    decimal SavedToDate);

public sealed record ProjectBudgetItemResponse(
    long Id,
    long ProjectId,
    string Category,
    string Item,
    string? Description,
    string? Unit,
    string? Quantity,
    string? UnitCost,
    string? TotalCost,
    string? ActualCost,
    string Status,
    string? Timeline,
    string? Notes,
    DateTimeOffset CreatedAt);

public sealed record ProjectContactResponse(
    long Id,
    long ProjectId,
    string Role,
    string? Name,
    string? Phone,
    string? Email,
    string Status,
    string? Notes);

public sealed record ProjectDecisionResponse(
    long Id,
    long ProjectId,
    DateOnly DecidedAt,
    string Decision,
    string? Rationale,
    string? Impact,
    DateTimeOffset CreatedAt);

public sealed record ProjectCheckinResponse(
    long Id,
    long ProjectId,
    DateOnly WeekOf,
    string? AttorneyStatus,
    bool? SavingsConfirmed,
    string? DepositZar,
    string? SupplierProgress,
    string? OpenIssues,
    string? ActionsNextCall,
    string? DecisionsNeeded,
    DateTimeOffset CreatedAt);

public sealed record MilestoneResponse(
    long Id,
    long ProjectId,
    string TargetDate,
    string Milestone,
    string Status,
    string? Owner,
    bool IsMajor,
    DateTimeOffset CreatedAt);

internal sealed record ProjectActor(Guid UserId, Guid OrganizationId, string Name);
