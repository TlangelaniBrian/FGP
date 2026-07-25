using NetTopologySuite.Geometries;
using System.Text.Json;

namespace FGP.Api.Data.Entities;

public sealed class Parcel
{
    public long Id { get; set; }
    public required string ErfNumber { get; set; }
    public string? Township { get; set; }
    public string Province { get; set; } = "Gauteng";
    public string? Municipality { get; set; }
    public decimal? SizeSqm { get; set; }
    public required Polygon Boundary { get; set; }
    public Point? Centroid { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class ZoningDesignation
{
    public long Id { get; set; }
    public required string Municipality { get; set; }
    public required string ZoneCode { get; set; }
    public string? ZoneLabel { get; set; }
    public required MultiPolygon Geometry { get; set; }
    public int? SchemeYear { get; set; }
    public string? SourceUrl { get; set; }
    public DateOnly? LastUpdated { get; set; }
}

public sealed class ZoningSchemeRule
{
    public int Id { get; set; }
    public required string Municipality { get; set; }
    public required string ZoneCode { get; set; }
    public string? ZoneLabel { get; set; }
    public int? MaxUnitsPerHa { get; set; }
    public int? MaxUnitsPerErf { get; set; }
    public decimal? CoveragePct { get; set; }
    public decimal? Far { get; set; }
    public decimal? MaxHeightM { get; set; }
    public int? MaxStoreys { get; set; }
    public decimal? BuildingLineFrontM { get; set; }
    public decimal? BuildingLineSideM { get; set; }
    public decimal? BuildingLineRearM { get; set; }
    public string[]? PermittedUses { get; set; }
    public string[]? ConsentUses { get; set; }
    public string[]? RezoningPossibleTo { get; set; }
    public string? RezoningDifficulty { get; set; }
    public decimal? RezoningApprovalRate { get; set; }
    public string[]? FormsRequired { get; set; }
    public string? SchemeDocument { get; set; }
    public int? SchemeYear { get; set; }
    public DateOnly? LastUpdated { get; set; }
}

public sealed class DolomiteZone
{
    public long Id { get; set; }
    public required string RiskClass { get; set; }
    public required MultiPolygon Geometry { get; set; }
    public string? CgsReference { get; set; }
    public string? Notes { get; set; }
}

public sealed class LandUseHexagon
{
    public long Id { get; set; }
    public string? H3Index { get; set; }
    public string? LandUseClass { get; set; }
    public int? Pop2026Est { get; set; }
    public decimal? SocioecoRisk { get; set; }
    public bool NewDevFlag { get; set; }
    public Polygon? Geometry { get; set; }
    public int? Year { get; set; }
}

public sealed class Amenity
{
    public long Id { get; set; }
    public required string Name { get; set; }
    public required string Type { get; set; }
    public string? Subtype { get; set; }
    public required Point Geometry { get; set; }
    public string? Source { get; set; }
}

public sealed class Listing
{
    public long Id { get; set; }
    public Guid OrganizationId { get; set; }
    public required string Source { get; set; }
    public string? SourceId { get; set; }
    public string? SourceUrl { get; set; }
    public DateTimeOffset? ScrapedAt { get; set; }
    public string? Address { get; set; }
    public string? Suburb { get; set; }
    public string? City { get; set; }
    public string? Municipality { get; set; }
    public Point? Coordinates { get; set; }
    public decimal? SizeSqm { get; set; }
    public decimal? Price { get; set; }
    public decimal? PricePerSqm { get; private set; }
    public string ListingType { get; set; } = "vacant_land";
    public string? Description { get; set; }
    public long? ParcelId { get; set; }
    public string? ZoneCode { get; set; }
    public string? DolomiteRisk { get; set; }
    public string Status { get; set; } = "new";
    public int? FeasibilityScore { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class FeasibilityReport
{
    public long Id { get; set; }
    public Guid OrganizationId { get; set; }
    public long ListingId { get; set; }
    public Guid? UserId { get; set; }
    public required string UnitType { get; set; }
    public int TargetUnits { get; set; }
    public decimal BuildRatePerSqm { get; set; } = 13500;
    public int TariffYear { get; set; } = 2026;
    public int? MaxUnitsAllowed { get; set; }
    public decimal? MaxBuildableSqm { get; set; }
    public decimal? MaxFootprintSqm { get; set; }
    public bool RezoningRequired { get; set; }
    public decimal? CostLand { get; set; }
    public decimal? CostBuild { get; set; }
    public decimal? CostProfessionalFees { get; set; }
    public decimal? CostBulkContributions { get; set; }
    public decimal? CostTransferDuty { get; set; }
    public decimal? CostTotal { get; set; }
    public decimal? RentPerUnitMonthly { get; set; }
    public decimal? GrossMonthlyIncome { get; set; }
    public decimal? GrossAnnualIncome { get; set; }
    public decimal? YieldGrossPct { get; set; }
    public decimal? YieldAt85OccPct { get; set; }
    public bool? Viable { get; set; }
    public string? ViabilityNotes { get; set; }
    public int? ScoreSchools { get; set; }
    public int? ScoreTransport { get; set; }
    public int? ScoreAmenities { get; set; }
    public string? PdfPackageUrl { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class ComplianceDocument
{
    public long Id { get; set; }
    public Guid OrganizationId { get; set; }
    public long? ReportId { get; set; }
    public long? ListingId { get; set; }
    public required string DocType { get; set; }
    public string? Municipality { get; set; }
    public string Status { get; set; } = "draft";
    public JsonDocument? PrefilledData { get; set; }
    public string? PdfUrl { get; set; }
    public DateTimeOffset? SubmittedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class ScrapeJob
{
    public long Id { get; set; }
    public Guid OrganizationId { get; set; }
    public required string Source { get; set; }
    public JsonDocument? SearchParams { get; set; }
    public string Status { get; set; } = "queued";
    public int ListingsFound { get; set; }
    public int ListingsNew { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
