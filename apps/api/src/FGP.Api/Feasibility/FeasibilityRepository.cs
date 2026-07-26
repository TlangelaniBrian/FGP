using FGP.Api.Data;
using FGP.Api.Data.Entities;

namespace FGP.Api.Feasibility;

public sealed class FeasibilityRepository(FgpDbContext database)
{
    public async Task<SavedFeasibility> SaveAsync(
        FeasibilityRequest request,
        FeasibilityResult result,
        Guid userId,
        Guid organizationId,
        CancellationToken cancellationToken)
    {
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var listing = new Listing
        {
            OrganizationId = organizationId,
            Source = "manual",
            Address = request.Address,
            Municipality = request.Municipality,
            SizeSqm = request.SizeSqm,
            Price = request.Price,
            ZoneCode = request.ZoneCode!.ToUpperInvariant(),
            DolomiteRisk = result.DolomiteRisk,
            Status = "analyzed",
            FeasibilityScore = result.Score,
            CreatedAt = now,
            UpdatedAt = now,
        };
        database.Listings.Add(listing);
        await database.SaveChangesAsync(cancellationToken);

        var report = new FeasibilityReport
        {
            OrganizationId = organizationId,
            ListingId = listing.Id,
            UserId = userId,
            UnitType = request.UnitType!,
            TargetUnits = request.TargetUnits,
            ActualUnits = result.ActualUnits,
            BuildRatePerSqm = result.BuildRatePerSqm,
            TariffYear = result.TariffYear,
            MaxUnitsAllowed = result.MaxUnitsAllowed,
            DecisionStatus = result.DecisionStatus,
            ZoningEvidenceAvailable = result.ZoningEvidenceAvailable,
            CapacityDensityUnits = result.Capacity.DensityUnits,
            CapacityFarUnits = result.Capacity.FarUnits,
            CapacityFootprintStoreyUnits = result.Capacity.FootprintStoreyUnits,
            MaxBuildableSqm = result.MaxBuildableSqm,
            MaxFootprintSqm = result.MaxFootprintSqm,
            RezoningRequired = result.RezoningRequired,
            CostLand = result.CostLand,
            CostBuild = result.CostBuild,
            CostProfessionalFees = result.CostProfessionalFees,
            CostBulkContributions = result.CostBulkContributions,
            CostTransferDuty = result.CostTransferDuty,
            CostTotal = result.CostTotal,
            RentPerUnitMonthly = result.RentPerUnitMonthly,
            GrossMonthlyIncome = result.GrossMonthlyIncome,
            GrossAnnualIncome = result.GrossAnnualIncome,
            YieldGrossPct = result.YieldGrossPct,
            YieldAt85OccPct = result.YieldAt85OccPct,
            Viable = result.Viable,
            ViabilityNotes = result.ViabilityNotes,
            CreatedAt = now,
        };
        database.FeasibilityReports.Add(report);
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new SavedFeasibility(listing.Id, report.Id);
    }
}

public sealed record SavedFeasibility(long ListingId, long ReportId);
