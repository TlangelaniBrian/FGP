using FGP.Api.Data;
using FGP.Api.Identity;
using FGP.Api.Worker;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace FGP.Api.Analysis;

public static class AnalysisEndpoints
{
    private static readonly HashSet<string> Municipalities = ["johannesburg", "tshwane", "ekurhuleni"];
    private static readonly HashSet<string> UnitTypes = ["bachelor", "1bed", "2bed", "luxury"];

    public static void MapAnalysisEndpoints(this WebApplication app)
    {
        var analysis = app.MapGroup("/api");
        analysis.MapPost("/parcel", AnalyzeParcelAsync).RequireAuthorization();
        analysis.MapPost("/feasibility", AnalyzeFeasibilityAsync).RequireAuthorization();
    }

    private static async Task<IResult> AnalyzeParcelAsync(
        ParcelRequest request,
        IWorkerClient worker,
        CancellationToken cancellationToken)
    {
        if (request.Lat is < -27 or > -25 || request.Lng is < 27 or > 29.5)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["coordinates"] = ["Coordinates must be within the Gauteng service boundary."] });
        }

        return ForwardWorkerResponse(await worker.PostAsync("/analyze/parcel", request, cancellationToken));
    }

    private static async Task<IResult> AnalyzeFeasibilityAsync(
        FeasibilityRequest request,
        FgpDbContext database,
        IWorkerClient worker,
        CancellationToken cancellationToken)
    {
        var municipality = request.Municipality?.Trim().ToLowerInvariant();
        var unitType = request.UnitType?.Trim().ToLowerInvariant();
        var zoneCode = request.ZoneCode?.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(request.Address) || municipality is null || !Municipalities.Contains(municipality) ||
            string.IsNullOrWhiteSpace(zoneCode) || zoneCode.Length > 20 || !zoneCode.All(character => char.IsLetterOrDigit(character) || character is '-' or '_') ||
            request.SizeSqm is < 100 or > 1_000_000 || request.Price is < 10_000 or > 500_000_000 ||
            unitType is null || !UnitTypes.Contains(unitType) || request.TargetUnits is < 1 or > 200 || request.TariffYear is < 2024 or > 2030)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = ["The feasibility request is invalid."] });
        }

        var rule = await database.ZoningSchemeRules
            .AsNoTracking()
            .Where(candidate => candidate.Municipality == municipality && candidate.ZoneCode == zoneCode)
            .Select(candidate => new ZoneRulesRequest(
                candidate.CoveragePct,
                candidate.Far,
                candidate.MaxStoreys,
                candidate.MaxUnitsPerErf,
                candidate.MaxUnitsPerHa))
            .SingleOrDefaultAsync(cancellationToken);

        var workerRequest = new WorkerFeasibilityRequest(
            request.Address.Trim(),
            municipality,
            zoneCode,
            request.SizeSqm,
            request.Price,
            unitType,
            request.TargetUnits,
            request.TariffYear,
            rule);
        return ForwardWorkerResponse(await worker.PostAsync("/analyze/feasibility", workerRequest, cancellationToken));
    }

    private static IResult ForwardWorkerResponse(WorkerResponse response)
    {
        if (response.StatusCode is >= HttpStatusCode.OK and < HttpStatusCode.MultipleChoices)
        {
            return Results.Content(response.Body, "application/json", statusCode: (int)response.StatusCode);
        }

        var message = response.Body;
        try
        {
            using var document = JsonDocument.Parse(response.Body);
            if (document.RootElement.TryGetProperty("detail", out var detail)) message = detail.ToString();
        }
        catch (JsonException)
        {
        }
        return Results.Json(new ApiError("WorkerError", message), statusCode: (int)response.StatusCode);
    }
}

public sealed record ParcelRequest(
    [property: JsonPropertyName("lat")] double Lat,
    [property: JsonPropertyName("lng")] double Lng);

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
    [property: JsonPropertyName("zone_rules")] ZoneRulesRequest? ZoneRules);

public sealed record ZoneRulesRequest(
    [property: JsonPropertyName("coverage_pct")] decimal? CoveragePct,
    [property: JsonPropertyName("far")] decimal? Far,
    [property: JsonPropertyName("max_storeys")] int? MaxStoreys,
    [property: JsonPropertyName("max_units_per_erf")] int? MaxUnitsPerErf,
    [property: JsonPropertyName("max_units_per_ha")] int? MaxUnitsPerHa);
