using FGP.Api.Data;
using FGP.Api.Identity;
using FGP.Api.Organizations;
using FGP.Api.Spatial;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Diagnostics;
using System.Net;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace FGP.Api.Feasibility;

public static class FeasibilityEndpoints
{
    private static readonly HashSet<string> Municipalities =
    [
        "johannesburg",
        "tshwane",
        "ekurhuleni",
    ];
    private static readonly HashSet<string> UnitTypes =
    [
        "bachelor",
        "1bed",
        "2bed",
        "luxury",
    ];
    private static readonly JsonSerializerOptions StrictRequestJson = new()
    {
        PropertyNameCaseInsensitive = false,
        NumberHandling = JsonNumberHandling.Strict,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
    };
    private static readonly JsonSerializerOptions WorkerResultJson = new()
    {
        PropertyNameCaseInsensitive = false,
        NumberHandling = JsonNumberHandling.Strict,
    };

    public static void MapFeasibilityEndpoints(this WebApplication app)
    {
        app.MapPost("/api/feasibility", AnalyzeFeasibilityAsync).RequireAuthorization();
        app.MapPost("/api/feasibility/save", SaveFeasibilityAsync)
            .RequireAuthorization(Capabilities.RecordContribution);
    }

    private static async Task<IResult> AnalyzeFeasibilityAsync(
        JsonElement body,
        HttpContext httpContext,
        FgpDbContext database,
        IWorkerClient worker,
        IOptions<AnalysisEndpointOptions> endpointOptions,
        CancellationToken requestCancellation)
    {
        var apiTimer = Stopwatch.StartNew();
        var workerElapsed = TimeSpan.Zero;
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(requestCancellation);
        deadline.CancelAfter(TimeSpan.FromMilliseconds(endpointOptions.Value.EndpointTimeoutMilliseconds));
        if (!TryParseRequest(body, out var request, out var validationResult))
        {
            return validationResult!;
        }
        if (!TryGetActor(httpContext.User, out _, out var organizationId))
        {
            return Results.Unauthorized();
        }

        try
        {
            deadline.Token.ThrowIfCancellationRequested();
            if (!await HasActiveMembershipAsync(
                    database,
                    httpContext.User,
                    organizationId,
                    deadline.Token))
            {
                return Results.Unauthorized();
            }
            var workerCall = await CallWorkerAsync(
                database,
                worker,
                request!,
                organizationId,
                deadline.Token);
            workerElapsed = workerCall.Elapsed;
            WorkerEndpointResponses.RecordTiming(httpContext, workerElapsed, apiTimer.Elapsed);
            if (workerCall.Response.StatusCode != HttpStatusCode.OK)
            {
                return WorkerEndpointResponses.Forward(workerCall.Response);
            }
            if (!TryParseWorkerResult(workerCall.Response.Body, out var result))
            {
                return WorkerEndpointResponses.InvalidWorkerResult();
            }

            deadline.Token.ThrowIfCancellationRequested();
            return Results.Json(result);
        }
        catch (ZoningRuleLoadException)
        {
            WorkerEndpointResponses.RecordTiming(httpContext, workerElapsed, apiTimer.Elapsed);
            return WorkerEndpointResponses.ZoningRulesUnavailable();
        }
        catch (OperationCanceledException)
            when (deadline.IsCancellationRequested && !requestCancellation.IsCancellationRequested)
        {
            WorkerEndpointResponses.RecordTiming(httpContext, workerElapsed, apiTimer.Elapsed);
            return WorkerEndpointResponses.UnavailableResult();
        }
    }

    private static async Task<IResult> SaveFeasibilityAsync(
        JsonElement body,
        HttpContext httpContext,
        FgpDbContext database,
        IWorkerClient worker,
        FeasibilityRepository repository,
        IOptions<AnalysisEndpointOptions> endpointOptions,
        CancellationToken requestCancellation)
    {
        var apiTimer = Stopwatch.StartNew();
        var workerElapsed = TimeSpan.Zero;
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(requestCancellation);
        deadline.CancelAfter(TimeSpan.FromMilliseconds(endpointOptions.Value.EndpointTimeoutMilliseconds));
        if (!TryParseRequest(body, out var request, out var validationResult))
        {
            return validationResult!;
        }
        if (!TryGetActor(httpContext.User, out var userId, out var organizationId))
        {
            return Results.Unauthorized();
        }

        try
        {
            deadline.Token.ThrowIfCancellationRequested();
            if (!await HasActiveMembershipAsync(
                    database,
                    httpContext.User,
                    organizationId,
                    deadline.Token))
            {
                return Results.Unauthorized();
            }
            var workerCall = await CallWorkerAsync(
                database,
                worker,
                request!,
                organizationId,
                deadline.Token);
            workerElapsed = workerCall.Elapsed;
            if (workerCall.Response.StatusCode != HttpStatusCode.OK)
            {
                WorkerEndpointResponses.RecordTiming(httpContext, workerElapsed, apiTimer.Elapsed);
                return WorkerEndpointResponses.Forward(workerCall.Response);
            }
            if (!TryParseWorkerResult(workerCall.Response.Body, out var result))
            {
                WorkerEndpointResponses.RecordTiming(httpContext, workerElapsed, apiTimer.Elapsed);
                return WorkerEndpointResponses.InvalidWorkerResult();
            }
            deadline.Token.ThrowIfCancellationRequested();
            var saved = await repository.SaveAsync(
                request!,
                result!,
                userId,
                organizationId,
                deadline.Token);
            WorkerEndpointResponses.RecordTiming(httpContext, workerElapsed, apiTimer.Elapsed);
            return Results.Ok(saved);
        }
        catch (ZoningRuleLoadException)
        {
            WorkerEndpointResponses.RecordTiming(httpContext, workerElapsed, apiTimer.Elapsed);
            return WorkerEndpointResponses.ZoningRulesUnavailable();
        }
        catch (OperationCanceledException)
            when (deadline.IsCancellationRequested && !requestCancellation.IsCancellationRequested)
        {
            WorkerEndpointResponses.RecordTiming(httpContext, workerElapsed, apiTimer.Elapsed);
            return WorkerEndpointResponses.UnavailableResult();
        }
    }

    private static bool TryParseRequest(
        JsonElement body,
        out FeasibilityRequest? request,
        out IResult? validationResult)
    {
        try
        {
            request = body.Deserialize<FeasibilityRequest>(StrictRequestJson);
        }
        catch (JsonException)
        {
            request = null;
            validationResult = WorkerEndpointResponses.InvalidBody();
            return false;
        }

        if (request is null)
        {
            validationResult = WorkerEndpointResponses.InvalidBody();
            return false;
        }

        var errors = new Dictionary<string, string[]>();
        if (request.Address is null || request.Address.Length is < 1 or > 500)
        {
            errors["address"] = ["Address must contain between 1 and 500 characters."];
        }
        if (request.Municipality is null || !Municipalities.Contains(request.Municipality))
        {
            errors["municipality"] = ["Municipality is not supported."];
        }
        if (request.ZoneCode is null ||
            request.ZoneCode.Length is < 1 or > 20 ||
            !request.ZoneCode.All(IsAsciiZoneCodeCharacter))
        {
            errors["zone_code"] = ["Zone code must be 1 to 20 alphanumeric, underscore, or hyphen characters."];
        }
        if (request.SizeSqm is < 100 or > 1_000_000)
        {
            errors["size_sqm"] = ["Site size must be between 100 and 1,000,000 square metres."];
        }
        if (request.Price is < 10_000 or > 500_000_000)
        {
            errors["price"] = ["Price must be between 10,000 and 500,000,000."];
        }
        if (request.UnitType is null || !UnitTypes.Contains(request.UnitType))
        {
            errors["unit_type"] = ["Unit type is not supported."];
        }
        if (request.TargetUnits is < 1 or > 200)
        {
            errors["target_units"] = ["Target units must be between 1 and 200."];
        }
        if (request.TariffYear is < 2024 or > 2030)
        {
            errors["tariff_year"] = ["Tariff year must be between 2024 and 2030."];
        }
        if (errors.Count > 0)
        {
            validationResult = WorkerEndpointResponses.Invalid(errors);
            return false;
        }

        validationResult = null;
        return true;
    }

    private static async Task<(WorkerResponse Response, TimeSpan Elapsed)> CallWorkerAsync(
        FgpDbContext database,
        IWorkerClient worker,
        FeasibilityRequest request,
        Guid organizationId,
        CancellationToken cancellationToken)
    {
        var zoneCode = request.ZoneCode!.ToUpperInvariant();
        ZoneRulesRequest? rule;
        try
        {
            rule = await database.ZoningSchemeRules
                .AsNoTracking()
                .Where(candidate =>
                    candidate.Municipality == request.Municipality &&
                    candidate.ZoneCode == zoneCode)
                .Select(candidate => new ZoneRulesRequest(
                    candidate.CoveragePct,
                    candidate.Far,
                    candidate.MaxStoreys,
                    candidate.MaxUnitsPerErf,
                    candidate.MaxUnitsPerHa))
                .SingleOrDefaultAsync(cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            throw new ZoningRuleLoadException(exception);
        }
        var workerRequest = new WorkerFeasibilityRequest(
            request.Address!,
            request.Municipality!,
            request.ZoneCode!,
            request.SizeSqm,
            request.Price,
            request.UnitType!,
            request.TargetUnits,
            request.TariffYear,
            organizationId,
            rule);
        return await WorkerEndpointResponses.CallAsync(
            worker,
            "/analyze/feasibility",
            workerRequest,
            cancellationToken);
    }

    private static bool TryParseWorkerResult(string body, out FeasibilityResult? result)
    {
        try
        {
            result = JsonSerializer.Deserialize<FeasibilityResult>(body, WorkerResultJson);
        }
        catch (JsonException)
        {
            result = null;
            return false;
        }

        return result is not null && result.IsValid();
    }

    private static bool TryGetActor(
        ClaimsPrincipal principal,
        out Guid userId,
        out Guid organizationId)
    {
        userId = default;
        organizationId = default;
        return Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out userId) &&
               Guid.TryParse(principal.FindFirstValue("organization_id"), out organizationId);
    }

    private static async Task<bool> HasActiveMembershipAsync(
        FgpDbContext database,
        ClaimsPrincipal principal,
        Guid organizationId,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(
                principal.FindFirstValue(ClaimTypes.NameIdentifier),
                out var userId))
        {
            return false;
        }

        return await database.Memberships
            .AsNoTracking()
            .AnyAsync(
                membership =>
                    membership.UserId == userId &&
                    membership.OrganizationId == organizationId &&
                    membership.Status == MembershipStatus.Active,
                cancellationToken);
    }

    private static bool IsAsciiZoneCodeCharacter(char character) =>
        character is >= 'a' and <= 'z' or >= 'A' and <= 'Z' or >= '0' and <= '9' or '-' or '_';
}

internal sealed class ZoningRuleLoadException(Exception innerException) :
    Exception("Zoning rules could not be loaded.", innerException);

public sealed record FeasibilityRequest(
    [property: JsonPropertyName("address")] string? Address,
    [property: JsonPropertyName("municipality")] string? Municipality,
    [property: JsonPropertyName("zone_code")] string? ZoneCode,
    [property: JsonPropertyName("size_sqm")] decimal SizeSqm,
    [property: JsonPropertyName("price")] decimal Price,
    [property: JsonPropertyName("unit_type")] string? UnitType,
    [property: JsonPropertyName("target_units")] int TargetUnits,
    [property: JsonPropertyName("tariff_year")] int TariffYear);

public sealed record WorkerFeasibilityRequest(
    [property: JsonPropertyName("address")] string Address,
    [property: JsonPropertyName("municipality")] string Municipality,
    [property: JsonPropertyName("zone_code")] string ZoneCode,
    [property: JsonPropertyName("size_sqm")] decimal SizeSqm,
    [property: JsonPropertyName("price")] decimal Price,
    [property: JsonPropertyName("unit_type")] string UnitType,
    [property: JsonPropertyName("target_units")] int TargetUnits,
    [property: JsonPropertyName("tariff_year")] int TariffYear,
    [property: JsonPropertyName("organization_id")] Guid OrganizationId,
    [property: JsonPropertyName("zone_rules"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    ZoneRulesRequest? ZoneRules);

public sealed record ZoneRulesRequest(
    [property: JsonPropertyName("coverage_pct")] decimal? CoveragePct,
    [property: JsonPropertyName("far")] decimal? Far,
    [property: JsonPropertyName("max_storeys")] int? MaxStoreys,
    [property: JsonPropertyName("max_units_per_erf")] int? MaxUnitsPerErf,
    [property: JsonPropertyName("max_units_per_ha")] int? MaxUnitsPerHa);

public sealed class FeasibilityResult
{
    [JsonPropertyName("viable")]
    public required bool Viable { get; init; }

    [JsonPropertyName("decision_status")]
    public required string DecisionStatus { get; init; }

    [JsonPropertyName("zoning_evidence_available")]
    public required bool ZoningEvidenceAvailable { get; init; }

    [JsonPropertyName("tariff_year")]
    public required int TariffYear { get; init; }

    [JsonPropertyName("build_rate_per_sqm")]
    public required decimal BuildRatePerSqm { get; init; }

    [JsonPropertyName("score")]
    public required int Score { get; init; }

    [JsonPropertyName("actual_units")]
    public required int ActualUnits { get; init; }

    [JsonPropertyName("max_units_allowed")]
    public required int? MaxUnitsAllowed { get; init; }

    [JsonPropertyName("rezoning_required")]
    public required bool RezoningRequired { get; init; }

    [JsonPropertyName("capacity")]
    public required FeasibilityCapacity Capacity { get; init; }

    [JsonPropertyName("max_footprint_sqm")]
    public required decimal? MaxFootprintSqm { get; init; }

    [JsonPropertyName("max_buildable_sqm")]
    public required decimal? MaxBuildableSqm { get; init; }

    [JsonPropertyName("cost_land")]
    public required decimal CostLand { get; init; }

    [JsonPropertyName("cost_build")]
    public required decimal CostBuild { get; init; }

    [JsonPropertyName("cost_professional_fees")]
    public required decimal CostProfessionalFees { get; init; }

    [JsonPropertyName("cost_bulk_contributions")]
    public required decimal CostBulkContributions { get; init; }

    [JsonPropertyName("cost_transfer_duty")]
    public required decimal CostTransferDuty { get; init; }

    [JsonPropertyName("cost_total")]
    public required decimal CostTotal { get; init; }

    [JsonPropertyName("rent_per_unit_monthly")]
    public required decimal RentPerUnitMonthly { get; init; }

    [JsonPropertyName("gross_monthly_income")]
    public required decimal GrossMonthlyIncome { get; init; }

    [JsonPropertyName("gross_annual_income")]
    public required decimal GrossAnnualIncome { get; init; }

    [JsonPropertyName("yield_gross_pct")]
    public required decimal YieldGrossPct { get; init; }

    [JsonPropertyName("yield_at_85_occ_pct")]
    public required decimal YieldAt85OccPct { get; init; }

    [JsonPropertyName("viability_notes")]
    public required string ViabilityNotes { get; init; }

    [JsonPropertyName("dolomite_risk")]
    public required string DolomiteRisk { get; init; }

    [JsonPropertyName("score_schools")]
    public required int? ScoreSchools { get; init; }

    [JsonPropertyName("score_transport")]
    public required int? ScoreTransport { get; init; }

    [JsonPropertyName("score_amenities")]
    public required int? ScoreAmenities { get; init; }

    public bool IsValid() =>
        DecisionStatus is "definitive" or "degraded" &&
        TariffYear is >= 2024 and <= 2030 &&
        BuildRatePerSqm > 0 &&
        Score is >= 0 and <= 100 &&
        ActualUnits >= 0 &&
        IsNonNegative(MaxUnitsAllowed) &&
        Capacity is not null &&
        Capacity.IsValid() &&
        IsNonNegative(MaxFootprintSqm) &&
        IsNonNegative(MaxBuildableSqm) &&
        CostLand >= 0 &&
        CostBuild >= 0 &&
        CostProfessionalFees >= 0 &&
        CostBulkContributions >= 0 &&
        CostTransferDuty >= 0 &&
        CostTotal >= 0 &&
        RentPerUnitMonthly >= 0 &&
        GrossMonthlyIncome >= 0 &&
        GrossAnnualIncome >= 0 &&
        YieldGrossPct >= 0 &&
        YieldAt85OccPct >= 0 &&
        !string.IsNullOrWhiteSpace(ViabilityNotes) &&
        !string.IsNullOrWhiteSpace(DolomiteRisk);

    private static bool IsNonNegative(decimal? value) => value is null or >= 0;
    private static bool IsNonNegative(int? value) => value is null or >= 0;
}

public sealed class FeasibilityCapacity
{
    [JsonPropertyName("density_units")]
    public required int? DensityUnits { get; init; }

    [JsonPropertyName("far_units")]
    public required int? FarUnits { get; init; }

    [JsonPropertyName("footprint_storey_units")]
    public required int? FootprintStoreyUnits { get; init; }

    public bool IsValid() =>
        IsNonNegative(DensityUnits) &&
        IsNonNegative(FarUnits) &&
        IsNonNegative(FootprintStoreyUnits);

    private static bool IsNonNegative(int? value) => value is null or >= 0;
}
