using FGP.Api.Data;
using FGP.Api.Data.Entities;
using FGP.Api.Identity;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace FGP.Api.Projects;

public static class CheckInEndpoints
{
    public static void MapCheckInEndpoints(this WebApplication app)
    {
        app.MapPost("/api/projects/{id}/checkins", CreateCheckinAsync)
            .RequireAuthorization(Capabilities.RecordContribution);
    }

    private static async Task<IResult> CreateCheckinAsync(
        string id,
        CreateCheckinRequest request,
        HttpContext httpContext,
        FgpDbContext database,
        CancellationToken cancellationToken)
    {
        if (!long.TryParse(id, NumberStyles.None, CultureInfo.InvariantCulture, out var projectId))
        {
            return Results.Json(new { error = "invalid id" }, statusCode: StatusCodes.Status400BadRequest);
        }

        var actor = await ProjectEndpoints.ResolveActorAsync(httpContext, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();

        var projectExists = await database.Projects
            .AsNoTracking()
            .AnyAsync(
                project =>
                    project.Id == projectId &&
                    project.OrganizationId == actor.OrganizationId,
                cancellationToken);
        if (!projectExists)
        {
            return Results.Json(
                new { error = "project not found" },
                statusCode: StatusCodes.Status404NotFound);
        }

        var validationError = Validate(request, out var weekOf);
        if (validationError is not null)
        {
            return Results.Json(new { error = validationError }, statusCode: StatusCodes.Status422UnprocessableEntity);
        }

        var checkin = new ProjectCheckin
        {
            OrganizationId = actor.OrganizationId,
            ProjectId = projectId,
            WeekOf = weekOf,
            AttorneyStatus = request.AttorneyStatus,
            SavingsConfirmed = request.SavingsConfirmed,
            DepositZar = request.DepositZar,
            SupplierProgress = request.SupplierProgress,
            OpenIssues = request.OpenIssues,
            ActionsNextCall = request.ActionsNextCall,
            DecisionsNeeded = request.DecisionsNeeded,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        database.ProjectCheckins.Add(checkin);
        await database.SaveChangesAsync(cancellationToken);

        return Results.Json(ProjectEndpoints.ToResponse(checkin), statusCode: StatusCodes.Status201Created);
    }

    private static string? Validate(CreateCheckinRequest request, out DateOnly weekOf)
    {
        if (request.WeekOf is null ||
            request.WeekOf.Length != 10 ||
            !DateOnly.TryParseExact(
                request.WeekOf,
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out weekOf))
        {
            weekOf = default;
            return "weekOf must use YYYY-MM-DD";
        }
        if (request.AttorneyStatus?.Length > 1000)
        {
            return "attorneyStatus must contain no more than 1000 characters";
        }
        if (request.DepositZar is < 0 or > 100_000_000)
        {
            return "depositZar must be between 0 and 100000000";
        }
        if (request.SupplierProgress?.Length > 1000)
        {
            return "supplierProgress must contain no more than 1000 characters";
        }
        if (request.OpenIssues?.Length > 2000)
        {
            return "openIssues must contain no more than 2000 characters";
        }
        if (request.ActionsNextCall?.Length > 2000)
        {
            return "actionsNextCall must contain no more than 2000 characters";
        }
        if (request.DecisionsNeeded?.Length > 2000)
        {
            return "decisionsNeeded must contain no more than 2000 characters";
        }

        return null;
    }
}

public sealed record CreateCheckinRequest(
    string? WeekOf,
    string? AttorneyStatus = null,
    bool? SavingsConfirmed = null,
    decimal? DepositZar = null,
    string? SupplierProgress = null,
    string? OpenIssues = null,
    string? ActionsNextCall = null,
    string? DecisionsNeeded = null);
