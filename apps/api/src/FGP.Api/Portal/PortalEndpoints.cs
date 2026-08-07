using System.Security.Claims;
using System.Text.Json;
using FGP.Api.Artifacts;
using FGP.Api.CapitalFund;
using FGP.Api.Data;
using FGP.Api.Data.Entities;
using FGP.Api.Identity;
using FGP.Api.Organizations;
using FGP.Api.Spatial;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using NetTopologySuite.Geometries;

namespace FGP.Api.Portal;

public static class PortalEndpoints
{
    private static readonly string[] AllowedDocumentStatuses = ["draft", "ready", "submitted", "approved", "rejected"];

    public static void MapPortalEndpoints(this WebApplication app)
    {
        var portal = app.MapGroup("/api").RequireAuthorization();
        portal.MapGet("/dashboard", GetDashboardAsync);
        portal.MapGet("/activity", GetActivityAsync);
        portal.MapGet("/listings", ListListingsAsync);
        portal.MapPost("/listings", CreateListingAsync).RequireAuthorization(Capabilities.RecordContribution);
        portal.MapPost("/listings/{id:long}/link-parcel", LinkParcelAsync).RequireAuthorization(Capabilities.RecordContribution);
        portal.MapGet("/documents", ListDocumentsAsync);
        portal.MapPost("/documents", CreateDocumentsAsync).RequireAuthorization(Capabilities.RecordContribution);
        portal.MapPatch("/documents/{id:long}", UpdateDocumentAsync).RequireAuthorization(Capabilities.RecordContribution);
        portal.MapGet("/documents/{id:long}/download", DownloadDocumentAsync);
        portal.MapPost("/documents/{id:long}/download", GenerateDocumentAsync).RequireAuthorization(Capabilities.RecordContribution);
        portal.MapGet("/settings", GetSettingsAsync);
        portal.MapPut("/settings", PutSettingsAsync).RequireAuthorization(Capabilities.ManageTeam);
        portal.MapGet("/team", ListTeamAsync);
        portal.MapPost("/projects/{id:long}/details", AddProjectDetailAsync).RequireAuthorization(Capabilities.RecordContribution);
        portal.MapGet("/scrape/jobs", ListScrapeJobsAsync);
        portal.MapPost("/scrape/jobs", CreateScrapeJobAsync).RequireAuthorization(Capabilities.RecordContribution);
        portal.MapGet("/scrape/jobs/{id:long}", GetScrapeJobAsync);
        portal.MapPost("/scrape/jobs/{id:long}/run", RunScrapeJobAsync).RequireAuthorization(Capabilities.RecordContribution);
        portal.MapPost("/scrape/jobs/{id:long}/ingest", IngestScrapeJobAsync).RequireAuthorization(Capabilities.RecordContribution);
    }

    private static async Task<IResult> GetDashboardAsync(HttpContext http, FgpDbContext database, CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(http, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();
        var projects = await database.Projects.AsNoTracking().Where(item => item.OrganizationId == actor.OrganizationId).OrderByDescending(item => item.CreatedAt).ToListAsync(cancellationToken);
        var reports = await database.FeasibilityReports.AsNoTracking().Where(item => item.OrganizationId == actor.OrganizationId).ToListAsync(cancellationToken);
        var listings = await database.Listings.AsNoTracking().Where(item => item.OrganizationId == actor.OrganizationId && item.Status != "dismissed").ToListAsync(cancellationToken);
        var contributions = await database.CapitalContributions.AsNoTracking().Where(item => item.OrganizationId == actor.OrganizationId && item.IsCurrent && item.Status != CapitalFundStatuses.Removed).ToListAsync(cancellationToken);
        var activity = await database.ActivityEvents.AsNoTracking().Where(item => item.OrganizationId == actor.OrganizationId).OrderByDescending(item => item.CreatedAt).Take(4).ToListAsync(cancellationToken);
        return Results.Ok(new
        {
            projectRows = projects.Take(3).Select(ProjectSummary),
            projectCount = projects.Count,
            reportCount = reports.Count,
            avgYield = reports.Where(item => item.YieldAt85OccPct.HasValue).Select(item => item.YieldAt85OccPct!.Value).DefaultIfEmpty().Average(),
            fundTotal = contributions.Sum(item => item.Amount),
            pipelineValue = listings.Sum(item => item.Price ?? 0),
            latestProject = projects.FirstOrDefault() is { } latest ? ProjectSummary(latest) : null,
            topListing = listings.OrderByDescending(item => item.FeasibilityScore).ThenByDescending(item => item.CreatedAt).Select(item => ListingResponse(item)).FirstOrDefault(),
            activities = activity,
        });
    }

    private static async Task<IResult> GetActivityAsync(HttpContext http, FgpDbContext database, CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(http, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();
        return Results.Ok(await database.ActivityEvents.AsNoTracking().Where(item => item.OrganizationId == actor.OrganizationId).OrderByDescending(item => item.CreatedAt).Take(30).ToListAsync(cancellationToken));
    }

    private static async Task<IResult> ListListingsAsync(HttpContext http, FgpDbContext database, CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(http, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();
        var query = database.Listings.AsNoTracking().Where(item => item.OrganizationId == actor.OrganizationId);
        var search = http.Request.Query["q"].ToString().Trim();
        var status = http.Request.Query["status"].ToString().Trim();
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(item => (item.Address != null && item.Address.Contains(search)) || (item.Suburb != null && item.Suburb.Contains(search)));
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(item => item.Status == status);
        if (long.TryParse(http.Request.Query["id"], out var id)) query = query.Where(item => item.Id == id);
        var rows = await query.OrderByDescending(item => item.FeasibilityScore).ThenByDescending(item => item.CreatedAt).Take(100).ToListAsync(cancellationToken);
        var listingIds = rows.Select(item => item.Id).ToList();
        var latestYields = await database.FeasibilityReports.AsNoTracking()
            .Where(report => listingIds.Contains(report.ListingId) && report.YieldAt85OccPct != null)
            .GroupBy(report => report.ListingId)
            .Select(group => new { ListingId = group.Key, YieldAt85OccPct = group.OrderByDescending(report => report.Id).Select(report => report.YieldAt85OccPct).First() })
            .ToDictionaryAsync(item => item.ListingId, item => item.YieldAt85OccPct, cancellationToken);
        return Results.Ok(rows.Select(item => ListingResponse(item, latestYields.GetValueOrDefault(item.Id))));
    }

    private static async Task<IResult> CreateListingAsync([FromBody] ListingRequest request, HttpContext http, FgpDbContext database, CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(http, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Address) || request.SizeSqm <= 0 || request.Price <= 0) return Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = ["address, positive sizeSqm, and positive price are required"] });
        var listing = new Listing { OrganizationId = actor.OrganizationId, Source = "manual", Address = request.Address.Trim(), Municipality = request.Municipality, SizeSqm = request.SizeSqm, Price = request.Price, SourceUrl = request.SourceUrl, Description = request.Description, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        database.Listings.Add(listing);
        AddActivity(database, actor, "listing_imported", "Listing imported", listing.Address, "listing", null);
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/listings/{listing.Id}", ListingResponse(listing));
    }

    private static async Task<IResult> LinkParcelAsync(long id, [FromBody] CoordinateRequest request, HttpContext http, FgpDbContext database, IWorkerClient worker, CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(http, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();
        var listing = await database.Listings.SingleOrDefaultAsync(item => item.Id == id && item.OrganizationId == actor.OrganizationId, cancellationToken);
        if (listing is null) return Results.NotFound(new { error = "listing not found" });
        if (request.Lat is < -27 or > -25 || request.Lng is < 27 or > 29.5) return Results.ValidationProblem(new Dictionary<string, string[]> { ["coordinates"] = ["coordinates are outside the supported Gauteng bounds"] });
        var workerResponse = await worker.PostAsync("/analyze/parcel", new { lat = request.Lat, lng = request.Lng }, cancellationToken);
        if ((int)workerResponse.StatusCode is < 200 or >= 300) return Results.Json(new { error = "Spatial worker request failed" }, statusCode: StatusCodes.Status502BadGateway);
        using var analysis = JsonDocument.Parse(workerResponse.Body);
        var root = analysis.RootElement;
        if (!root.TryGetProperty("found", out var found) || !found.GetBoolean() || !root.TryGetProperty("parcel_id", out var parcelIdElement) || parcelIdElement.ValueKind == JsonValueKind.Null) return Results.NotFound(new { error = "No parcel found at these coordinates" });
        listing.ParcelId = parcelIdElement.GetInt64();
        listing.Coordinates = new Point(request.Lng, request.Lat) { SRID = 4326 };
        listing.ZoneCode = root.TryGetProperty("zone_code", out var zone) && zone.ValueKind != JsonValueKind.Null ? zone.GetString() : listing.ZoneCode;
        listing.DolomiteRisk = root.TryGetProperty("dolomite_risk", out var risk) && risk.ValueKind != JsonValueKind.Null ? risk.GetString() : listing.DolomiteRisk;
        listing.FeasibilityScore = root.TryGetProperty("score_composite", out var score) && score.ValueKind != JsonValueKind.Null ? score.GetInt32() : listing.FeasibilityScore;
        listing.UpdatedAt = DateTimeOffset.UtcNow;
        AddActivity(database, actor, "listing_parcel_linked", "Listing linked to parcel", $"{listing.Address} · parcel #{listing.ParcelId}", "listing", listing.Id.ToString());
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { listingId = listing.Id, parcelId = listing.ParcelId, analysis = root });
    }

    private static async Task<IResult> ListDocumentsAsync(HttpContext http, FgpDbContext database, CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(http, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();
        var query = database.ComplianceDocuments.AsNoTracking().Where(item => item.OrganizationId == actor.OrganizationId);
        if (long.TryParse(http.Request.Query["listingId"], out var listingId)) query = query.Where(item => item.ListingId == listingId);
        if (long.TryParse(http.Request.Query["reportId"], out var reportId)) query = query.Where(item => item.ReportId == reportId);
        return Results.Ok(await query.OrderByDescending(item => item.CreatedAt).ToListAsync(cancellationToken));
    }

    private static async Task<IResult> CreateDocumentsAsync([FromBody] DocumentRequest request, HttpContext http, FgpDbContext database, CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(http, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();
        if (request.Forms is not { Length: > 0 } || (request.ReportId is null && request.ListingId is null)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = ["forms and reportId or listingId are required"] });
        if (request.ListingId is not null && !await database.Listings.AnyAsync(item => item.Id == request.ListingId && item.OrganizationId == actor.OrganizationId, cancellationToken)) return Results.NotFound(new { error = "listing not found" });
        if (request.ReportId is not null && !await database.FeasibilityReports.AnyAsync(item => item.Id == request.ReportId && item.OrganizationId == actor.OrganizationId, cancellationToken)) return Results.NotFound(new { error = "feasibility report not found" });
        var rows = request.Forms.Select(docType => new ComplianceDocument { OrganizationId = actor.OrganizationId, ReportId = request.ReportId, ListingId = request.ListingId, Municipality = request.Municipality, DocType = docType, PrefilledData = request.PrefilledData is null ? null : JsonDocument.Parse(JsonSerializer.Serialize(request.PrefilledData)), CreatedAt = DateTimeOffset.UtcNow }).ToArray();
        database.ComplianceDocuments.AddRange(rows);
        AddActivity(database, actor, "documents_created", "Compliance package created", $"{rows.Length} draft documents", "listing", (request.ListingId ?? request.ReportId)?.ToString());
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created("/api/documents", rows);
    }

    private static async Task<IResult> UpdateDocumentAsync(long id, [FromBody] DocumentStatusRequest request, HttpContext http, FgpDbContext database, CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(http, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();
        if (!AllowedDocumentStatuses.Contains(request.Status, StringComparer.Ordinal)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["status"] = ["invalid document status"] });
        var document = await database.ComplianceDocuments.SingleOrDefaultAsync(item => item.Id == id && item.OrganizationId == actor.OrganizationId, cancellationToken);
        if (document is null) return Results.NotFound(new { error = "document not found" });
        document.Status = request.Status;
        document.SubmittedAt = request.Status == "submitted" ? DateTimeOffset.UtcNow : document.SubmittedAt;
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(document);
    }

    private static async Task<IResult> DownloadDocumentAsync(long id, HttpContext http, FgpDbContext database, IArtifactStorage artifacts, CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(http, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();
        var document = await database.ComplianceDocuments.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id && item.OrganizationId == actor.OrganizationId, cancellationToken);
        if (document is null) return Results.NotFound(new { error = "document not found" });
        if (string.IsNullOrWhiteSpace(document.PdfUrl)) return Results.NotFound(new { error = "document has not been generated" });
        var stream = await artifacts.OpenAsync(document.PdfUrl, cancellationToken);
        return stream is null
            ? Results.NotFound(new { error = "document has not been generated" })
            : Results.File(stream, "application/pdf", fileDownloadName: $"{document.DocType}.pdf");
    }

    private static async Task<IResult> GenerateDocumentAsync(long id, HttpContext http, FgpDbContext database, IWorkerClient worker, IArtifactStorage artifacts, CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(http, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();
        var document = await database.ComplianceDocuments.SingleOrDefaultAsync(item => item.Id == id && item.OrganizationId == actor.OrganizationId, cancellationToken);
        if (document is null) return Results.NotFound(new { error = "document not found" });

        var context = await BuildDocumentContextAsync(database, actor.OrganizationId, document, cancellationToken);
        var workerResponse = await worker.PostAsync("/forms/generate", new { doc_type = document.DocType, context }, cancellationToken);
        if ((int)workerResponse.StatusCode is < 200 or >= 300 || workerResponse.Content is not { Length: > 0 })
        {
            return Results.Json(new { error = "Document generation failed" }, statusCode: StatusCodes.Status502BadGateway);
        }

        var key = $"documents/{actor.OrganizationId:N}/{document.Id}.pdf";
        await artifacts.SaveAsync(key, workerResponse.Content, cancellationToken);
        document.PdfUrl = key;
        document.Status = "ready";
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(document);
    }

    private static async Task<Dictionary<string, object?>> BuildDocumentContextAsync(FgpDbContext database, Guid organizationId, ComplianceDocument document, CancellationToken cancellationToken)
    {
        var context = new Dictionary<string, object?>();
        if (document.PrefilledData is not null)
        {
            foreach (var property in document.PrefilledData.RootElement.EnumerateObject())
            {
                context[property.Name] = property.Value.ValueKind == JsonValueKind.String
                    ? property.Value.GetString()
                    : property.Value.Clone();
            }
        }
        void Fallback(string key, object? value)
        {
            if (!context.ContainsKey(key) && value is not null)
            {
                context[key] = value;
            }
        }
        if (document.ListingId is long listingId)
        {
            var listing = await database.Listings.AsNoTracking().SingleOrDefaultAsync(item => item.Id == listingId && item.OrganizationId == organizationId, cancellationToken);
            if (listing is not null)
            {
                Fallback("address", listing.Address);
                Fallback("municipality", listing.Municipality);
                Fallback("suburb", listing.Suburb);
                Fallback("zone_code", listing.ZoneCode);
                Fallback("dolomite_risk", listing.DolomiteRisk);
                Fallback("parcel_id", listing.ParcelId);
                if (listing.ParcelId is long parcelId)
                {
                    var parcel = await database.Parcels.AsNoTracking().SingleOrDefaultAsync(item => item.Id == parcelId, cancellationToken);
                    if (parcel is not null)
                    {
                        Fallback("erf_number", parcel.ErfNumber);
                        Fallback("township", parcel.Township);
                        Fallback("size_sqm", parcel.SizeSqm);
                    }
                }
                if (!string.IsNullOrWhiteSpace(listing.ZoneCode))
                {
                    var zone = await database.ZoningSchemeRules.AsNoTracking().SingleOrDefaultAsync(item => item.Municipality == listing.Municipality && item.ZoneCode == listing.ZoneCode, cancellationToken);
                    if (zone is not null)
                    {
                        Fallback("zone_label", zone.ZoneLabel);
                        Fallback("coverage_pct", zone.CoveragePct);
                        Fallback("far", zone.Far);
                        Fallback("max_storeys", zone.MaxStoreys);
                    }
                }
            }
        }
        return context;
    }


    private static async Task<IResult> GetSettingsAsync(HttpContext http, FgpDbContext database, CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(http, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();
        var rows = await database.OrganizationSettings.AsNoTracking().Where(item => item.OrganizationId == actor.OrganizationId).ToListAsync(cancellationToken);
        return Results.Ok(rows.ToDictionary(item => item.Key, item => item.Value.RootElement.Clone()));
    }

    private static async Task<IResult> PutSettingsAsync([FromBody] JsonElement settings, HttpContext http, FgpDbContext database, CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(http, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();
        if (settings.ValueKind != JsonValueKind.Object) return Results.ValidationProblem(new Dictionary<string, string[]> { ["settings"] = ["an object is required"] });
        foreach (var property in settings.EnumerateObject())
        {
            var row = await database.OrganizationSettings.SingleOrDefaultAsync(item => item.OrganizationId == actor.OrganizationId && item.Key == property.Name, cancellationToken);
            var value = JsonDocument.Parse(property.Value.GetRawText());
            if (row is null) database.OrganizationSettings.Add(new OrganizationSetting { OrganizationId = actor.OrganizationId, Key = property.Name, Value = value, UpdatedByUserId = actor.UserId, UpdatedAt = DateTimeOffset.UtcNow });
            else { row.Value = value; row.UpdatedByUserId = actor.UserId; row.UpdatedAt = DateTimeOffset.UtcNow; }
        }
        AddActivity(database, actor, "settings_update", "Workspace settings updated", string.Join(", ", settings.EnumerateObject().Select(item => item.Name)), "portal_settings", null);
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(settings);
    }

    private static async Task<IResult> ListTeamAsync(HttpContext http, FgpDbContext database, CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(http, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();
        return Results.Ok(await database.Memberships.AsNoTracking().Where(item => item.OrganizationId == actor.OrganizationId).Join(database.Users, member => member.UserId, user => user.Id, (member, user) => new { id = member.Id, userId = user.Id, email = user.Email, name = user.DisplayName, role = member.Role.ToString(), status = member.Status.ToString().ToLowerInvariant() }).ToListAsync(cancellationToken));
    }

    private static async Task<IResult> AddProjectDetailAsync(long id, [FromBody] JsonElement request, HttpContext http, FgpDbContext database, CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(http, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();
        var project = await database.Projects.SingleOrDefaultAsync(item => item.Id == id && item.OrganizationId == actor.OrganizationId, cancellationToken);
        if (project is null) return Results.NotFound(new { error = "project not found" });
        if (!request.TryGetProperty("action", out var actionProperty) || actionProperty.ValueKind != JsonValueKind.String)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["action"] = ["action is required"] });
        }

        var action = actionProperty.GetString();
        object? response;
        switch (action)
        {
            case "budget":
                if (!TryGetString(request, "category", out var category) || !TryGetString(request, "item", out var item) || !TryGetDecimal(request, "totalCost", out var totalCost) || totalCost < 0)
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = ["budget requires category, item, and a non-negative totalCost"] });
                }
                var budget = new ProjectBudgetItem { OrganizationId = actor.OrganizationId, ProjectId = id, Category = category, Item = item, TotalCost = totalCost, Status = TryGetString(request, "status", out var budgetStatus) ? budgetStatus : "estimate", CreatedAt = DateTimeOffset.UtcNow };
                database.ProjectBudgetItems.Add(budget);
                response = budget;
                break;
            case "contact":
                if (!TryGetString(request, "role", out var role) || !TryGetString(request, "name", out var name))
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = ["contact requires role and name"] });
                }
                var contact = new ProjectContact { OrganizationId = actor.OrganizationId, ProjectId = id, Role = role, Name = name, Email = TryGetString(request, "email", out var email) ? email : null, Phone = TryGetString(request, "phone", out var phone) ? phone : null, Status = TryGetString(request, "status", out var contactStatus) ? contactStatus : "pending" };
                database.ProjectContacts.Add(contact);
                response = contact;
                break;
            case "decision":
                if (!TryGetString(request, "decidedAt", out var decidedAtValue) || !DateOnly.TryParseExact(decidedAtValue, "yyyy-MM-dd", out var decidedAt) || !TryGetString(request, "decision", out var decision))
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = ["decision requires decidedAt (yyyy-MM-dd) and decision"] });
                }
                var decisionRow = new ProjectDecision { OrganizationId = actor.OrganizationId, ProjectId = id, DecidedAt = decidedAt, Decision = decision, Rationale = TryGetString(request, "rationale", out var rationale) ? rationale : null, Impact = TryGetString(request, "impact", out var impact) ? impact : null, CreatedAt = DateTimeOffset.UtcNow };
                database.ProjectDecisions.Add(decisionRow);
                response = decisionRow;
                break;
            case "milestone":
                if (!TryGetString(request, "targetDate", out var targetDate) || !TryGetString(request, "milestone", out var milestone))
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = ["milestone requires targetDate and milestone"] });
                }
                var milestoneRow = new Milestone { OrganizationId = actor.OrganizationId, ProjectId = id, TargetDate = targetDate, Name = milestone, Owner = TryGetString(request, "owner", out var owner) ? owner : null, Status = TryGetString(request, "status", out var milestoneStatus) ? milestoneStatus : "PENDING", CreatedAt = DateTimeOffset.UtcNow };
                database.Milestones.Add(milestoneRow);
                response = milestoneRow;
                break;
            default:
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["action"] = ["action must be budget, contact, decision, or milestone"] });
        }

        AddActivity(database, actor, $"project_{action}", $"Project detail added: {action}", project.Name ?? $"Project #{id}", "project", id.ToString());
        await database.SaveChangesAsync(cancellationToken);
        return Results.Json(response, statusCode: StatusCodes.Status201Created);
    }

    private static async Task<IResult> ListScrapeJobsAsync(HttpContext http, FgpDbContext database, CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(http, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();
        return Results.Ok(await database.ScrapeJobs.AsNoTracking().Where(item => item.OrganizationId == actor.OrganizationId).OrderByDescending(item => item.CreatedAt).Take(50).ToListAsync(cancellationToken));
    }

    private static async Task<IResult> CreateScrapeJobAsync([FromBody] ScrapeJobRequest request, HttpContext http, FgpDbContext database, CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(http, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Source) || string.IsNullOrWhiteSpace(request.Location)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = ["source and location are required"] });
        var job = new ScrapeJob { OrganizationId = actor.OrganizationId, Source = request.Source, SearchParams = JsonDocument.Parse(JsonSerializer.Serialize(request)), Status = "queued", CreatedAt = DateTimeOffset.UtcNow };
        database.ScrapeJobs.Add(job);
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/scrape/jobs/{job.Id}", job);
    }

    private static async Task<IResult> GetScrapeJobAsync(long id, HttpContext http, FgpDbContext database, CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(http, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();
        var job = await database.ScrapeJobs.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id && item.OrganizationId == actor.OrganizationId, cancellationToken);
        return job is null ? Results.NotFound(new { error = "not found" }) : Results.Ok(job);
    }

    private static Task<IResult> RunScrapeJobAsync(long id, HttpContext http, FgpDbContext database, CancellationToken cancellationToken) => Task.FromResult<IResult>(Results.Problem("Scraper execution requires explicit source-data approval.", statusCode: StatusCodes.Status409Conflict));
    private static Task<IResult> IngestScrapeJobAsync(long id, HttpContext http, FgpDbContext database, CancellationToken cancellationToken) => Task.FromResult<IResult>(Results.Problem("External listing import requires explicit source-data approval.", statusCode: StatusCodes.Status409Conflict));

    private static async Task<Actor?> ResolveActorAsync(HttpContext http, FgpDbContext database, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(http.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) || !Guid.TryParse(http.User.FindFirstValue("organization_id"), out var organizationId)) return null;
        return await database.Memberships.Where(item => item.OrganizationId == organizationId && item.UserId == userId && item.Status == MembershipStatus.Active).Join(database.Users, member => member.UserId, user => user.Id, (member, user) => new Actor(member.Id, member.OrganizationId, user.Id, user.DisplayName ?? user.UserName ?? "Member", user.Email ?? "")).SingleOrDefaultAsync(cancellationToken);
    }

    private static object ListingResponse(Listing item, decimal? yieldAt85OccPct = null) => new { item.Id, item.Source, item.SourceId, item.SourceUrl, item.Address, item.Suburb, item.City, item.Municipality, item.SizeSqm, item.Price, item.PricePerSqm, item.ListingType, item.Description, item.ParcelId, item.ZoneCode, item.DolomiteRisk, item.Status, item.FeasibilityScore, YieldAt85OccPct = yieldAt85OccPct, latitude = item.Coordinates?.Y, longitude = item.Coordinates?.X, item.CreatedAt, item.UpdatedAt };
    private static object ProjectSummary(Project item) => new { item.Id, item.Name, item.Status, township = (string?)null, erfNumber = (string?)null, phase1TargetZar = item.Phase1TargetZar, monthlySavingZar = item.MonthlySavingZar };
    private static void AddActivity(FgpDbContext database, Actor actor, string eventType, string title, string? detail, string? entityType, string? entityId) => database.ActivityEvents.Add(new ActivityEvent { OrganizationId = actor.OrganizationId, ActorUserId = actor.UserId, ActorName = actor.Name, EventType = eventType, Title = title, Detail = detail, EntityType = entityType, EntityId = entityId, CreatedAt = DateTimeOffset.UtcNow });

    private static bool TryGetString(JsonElement objectValue, string propertyName, out string value)
    {
        value = string.Empty;
        if (!objectValue.TryGetProperty(propertyName, out var property) || property.ValueKind != JsonValueKind.String) return false;
        var candidate = property.GetString();
        if (string.IsNullOrWhiteSpace(candidate)) return false;
        value = candidate;
        return true;
    }

    private static bool TryGetDecimal(JsonElement objectValue, string propertyName, out decimal value)
    {
        value = 0;
        return objectValue.TryGetProperty(propertyName, out var property) && property.TryGetDecimal(out value);
    }

    private sealed record Actor(Guid MembershipId, Guid OrganizationId, Guid UserId, string Name, string Email);
}

public sealed record ListingRequest(string? Address, string? Municipality, decimal SizeSqm, decimal Price, string? SourceUrl, string? Description);
public sealed record CoordinateRequest(double Lat, double Lng);
public sealed record DocumentRequest(long? ReportId, long? ListingId, string? Municipality, string[]? Forms, Dictionary<string, object>? PrefilledData);
public sealed record DocumentStatusRequest(string Status);
public sealed record ScrapeJobRequest(string? Source, string? Location, double RadiusKm = 20, double MinSizeSqm = 300, double MaxPrice = 5_000_000);
