using FGP.Api.Artifacts;
using FGP.Api.CapitalFund;
using FGP.Api.Data.Entities;
using FGP.Api.Identity;
using FGP.Api.Organizations;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite;
using NetTopologySuite.Geometries;
using System.Text;
using System.Text.Json;

namespace FGP.Api.Data.Seed;

/// <summary>
/// Seeds the deterministic portal working set — listings, feasibility reports, projects and
/// capital contributions — so every portal screen renders real content against a local database.
/// Rows are tagged <see cref="DemoSource"/> so a re-run replaces them without touching other data.
/// </summary>
public static class DemoPortalDataSeeder
{
    public const string DemoSource = "demo";

    private static readonly DateTimeOffset SeedTimestamp = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    private sealed record LeadSeed(
        string Address,
        string Suburb,
        string Municipality,
        string ZoneCode,
        string DolomiteRisk,
        decimal SizeSqm,
        decimal Price,
        int FeasibilityScore,
        string Status,
        double Longitude,
        double Latitude);

    private static readonly LeadSeed[] Leads =
    [
        new("Erf 14201, Molefe Makinta Drive", "Soshanguve South Ext 13", "tshwane", "RES3", "LOW", 1024m, 950_000m, 87, "active_project", 28.085, -25.54),
        new("Erf 2087, Bekker Road", "Noordwyk Ext 19", "johannesburg", "RES3", "LOW", 980m, 1_450_000m, 81, "active_project", 28.13, -25.976),
        new("Erf 551, Hans Strijdom Avenue", "Karenpark Ext 27", "tshwane", "RES2", "MEDIUM", 1500m, 1_180_000m, 74, "active_project", 28.16, -25.62),
        new("Erf 908, Sam Ntuli Street", "Clayville Ext 45", "ekurhuleni", "RES2", "MEDIUM", 1340m, 890_000m, 63, "analyzed", 28.21, -25.94),
        new("Erf 3312, Rachel de Beer Street", "Pretoria North", "tshwane", "RES4", "HIGH", 760m, 720_000m, 41, "new", 28.18, -25.66),
    ];

    private sealed record ProjectSeed(
        string Name,
        string Status,
        string ErfNumber,
        string Township,
        decimal MonthlySaving,
        decimal Phase1Target,
        int LeadIndex);

    private static readonly ProjectSeed[] ProjectSeeds =
    [
        new("Soshanguve Build", "construction", "14201", "Soshanguve South Ext 13", 25_000m, 760_000m, 0),
        new("Noordwyk", "compliance", "2087", "Noordwyk Ext 19", 18_000m, 1_100_000m, 1),
        new("Karenpark", "planning", "551", "Karenpark Ext 27", 12_000m, 640_000m, 2),
    ];

    public static async Task SeedAsync(
        FgpDbContext database,
        Guid organizationId,
        IArtifactStorage artifacts,
        CancellationToken cancellationToken = default)
    {
        await ClearAsync(database, organizationId, cancellationToken);

        var geometryFactory = NtsGeometryServices.Instance.CreateGeometryFactory(4326);
        var listings = new List<Listing>();
        foreach (var lead in Leads)
        {
            var listing = new Listing
            {
                OrganizationId = organizationId,
                Source = DemoSource,
                SourceId = lead.Address,
                Address = lead.Address,
                Suburb = lead.Suburb,
                City = lead.Suburb,
                Municipality = lead.Municipality,
                Coordinates = geometryFactory.CreatePoint(new Coordinate(lead.Longitude, lead.Latitude)),
                SizeSqm = lead.SizeSqm,
                Price = lead.Price,
                ListingType = "vacant_land",
                ZoneCode = lead.ZoneCode,
                DolomiteRisk = lead.DolomiteRisk,
                Status = lead.Status,
                FeasibilityScore = lead.FeasibilityScore,
                Description = $"{lead.SizeSqm:N0} m² vacant residential stand in {lead.Suburb}.",
                CreatedAt = SeedTimestamp,
                UpdatedAt = SeedTimestamp,
            };
            listings.Add(listing);
            database.Listings.Add(listing);
        }

        await database.SaveChangesAsync(cancellationToken);

        var reports = new List<FeasibilityReport>();
        for (var index = 0; index < ProjectSeeds.Length; index++)
        {
            var lead = Leads[ProjectSeeds[index].LeadIndex];
            var listing = listings[ProjectSeeds[index].LeadIndex];
            reports.Add(BuildReport(organizationId, listing.Id, lead));
        }

        database.FeasibilityReports.AddRange(reports);
        await database.SaveChangesAsync(cancellationToken);

        var projects = new List<Project>();
        for (var index = 0; index < ProjectSeeds.Length; index++)
        {
            var seed = ProjectSeeds[index];
            projects.Add(new Project
            {
                OrganizationId = organizationId,
                ListingId = listings[seed.LeadIndex].Id,
                ReportId = reports[index].Id,
                Name = seed.Name,
                Status = seed.Status,
                ErfNumber = seed.ErfNumber,
                Township = seed.Township,
                Partners = ["First Generation Properties"],
                MonthlySavingZar = seed.MonthlySaving,
                Phase1TargetZar = seed.Phase1Target,
                Scenario = "base",
                Notes = $"{seed.Name} — tracked from feasibility through delivery.",
                CreatedAt = SeedTimestamp,
                UpdatedAt = SeedTimestamp,
            });
        }

        database.Projects.AddRange(projects);
        await database.SaveChangesAsync(cancellationToken);

        SeedProjectDetail(database, organizationId, projects);
        await SeedCapitalContributionsAsync(database, organizationId, cancellationToken);
        await SeedComplianceDocumentAsync(database, artifacts, organizationId, listings[0].Id, cancellationToken);
        await database.SaveChangesAsync(cancellationToken);
    }

    private static async Task SeedComplianceDocumentAsync(
        FgpDbContext database,
        IArtifactStorage artifacts,
        Guid organizationId,
        long listingId,
        CancellationToken cancellationToken)
    {
        var lead = Leads[0];
        var key = $"documents/{organizationId:N}/demo/zoning-certificate.pdf";
        await artifacts.SaveAsync(key, BuildDemoZoningPdf(), cancellationToken);

        var document = new ComplianceDocument
        {
            OrganizationId = organizationId,
            ListingId = listingId,
            DocType = "zoning_certificate",
            Municipality = lead.Municipality,
            Status = "ready",
            PdfUrl = key,
            PrefilledData = JsonDocument.Parse(JsonSerializer.Serialize(new
            {
                address = lead.Address,
                municipality = lead.Municipality,
                zoneCode = lead.ZoneCode,
                dolomiteRisk = lead.DolomiteRisk,
            })),
            CreatedAt = SeedTimestamp,
        };
        database.ComplianceDocuments.Add(document);
        await database.SaveChangesAsync(cancellationToken);
    }

    private static byte[] BuildDemoZoningPdf()
    {
        using var stream = new MemoryStream();
        void Write(string text)
        {
            var bytes = Encoding.ASCII.GetBytes(text);
            stream.Write(bytes);
        }

        Write("%PDF-1.4\n");

        var streamContent = "BT /F1 12 Tf 72 770 Td (Demo zoning certificate - Erf 14201, Molefe Makinta Drive) Tj ET\n";
        var objects = new[]
        {
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
            $"<< /Length {Encoding.ASCII.GetByteCount(streamContent)} >>\nstream\n{streamContent}endstream",
        };

        var offsets = new long[objects.Length];
        for (var index = 0; index < objects.Length; index++)
        {
            offsets[index] = stream.Position;
            Write($"{index + 1} 0 obj\n{objects[index]}\nendobj\n");
        }

        var xrefOffset = stream.Position;
        Write($"xref\n0 {objects.Length + 1}\n");
        Write("0000000000 65535 f \n");
        foreach (var offset in offsets)
        {
            Write($"{offset:0000000000} 00000 n \n");
        }
        Write($"trailer\n<< /Size {objects.Length + 1} /Root 1 0 R >>\nstartxref\n{xrefOffset}\n%%EOF");
        return stream.ToArray();
    }

    private static FeasibilityReport BuildReport(Guid organizationId, long listingId, LeadSeed lead)
    {
        const decimal buildRate = 13_500m;
        const decimal unitSize = 35m;
        var units = (int)Math.Floor(lead.SizeSqm / 120m);
        var buildable = units * unitSize;
        var costBuild = buildable * buildRate;
        var costFees = Math.Round(costBuild * 0.11m, 2);
        var costBulk = units * 18_500m;
        var costTransfer = Math.Round(lead.Price * 0.06m, 2);
        var costTotal = lead.Price + costBuild + costFees + costBulk + costTransfer;
        var rentPerUnit = 4_200m;
        var grossMonthly = units * rentPerUnit;
        var grossAnnual = grossMonthly * 12m;
        var yieldGross = Math.Round(grossAnnual / costTotal * 100m, 2);

        return new FeasibilityReport
        {
            OrganizationId = organizationId,
            ListingId = listingId,
            UnitType = "bachelor",
            TargetUnits = units,
            ActualUnits = units,
            DecisionStatus = "definitive",
            ZoningEvidenceAvailable = true,
            BuildRatePerSqm = buildRate,
            TariffYear = 2026,
            MaxUnitsAllowed = units,
            MaxBuildableSqm = buildable,
            MaxFootprintSqm = Math.Round(lead.SizeSqm * 0.6m, 2),
            RezoningRequired = false,
            CostLand = lead.Price,
            CostBuild = costBuild,
            CostProfessionalFees = costFees,
            CostBulkContributions = costBulk,
            CostTransferDuty = costTransfer,
            CostTotal = costTotal,
            RentPerUnitMonthly = rentPerUnit,
            GrossMonthlyIncome = grossMonthly,
            GrossAnnualIncome = grossAnnual,
            YieldGrossPct = yieldGross,
            YieldAt85OccPct = Math.Round(yieldGross * 0.85m, 2),
            Viable = yieldGross >= 9m,
            ViabilityNotes = $"Modelled at {units} bachelor units on {lead.SizeSqm:N0} m².",
            ScoreSchools = lead.FeasibilityScore,
            ScoreTransport = Math.Max(0, lead.FeasibilityScore - 8),
            ScoreAmenities = Math.Max(0, lead.FeasibilityScore - 15),
            CreatedAt = SeedTimestamp,
        };
    }

    private static void SeedProjectDetail(FgpDbContext database, Guid organizationId, List<Project> projects)
    {
        foreach (var project in projects)
        {
            database.ProjectBudgetItems.AddRange(
                BudgetItem(organizationId, project.Id, "land", "Land acquisition", 1, 950_000m, "approved"),
                BudgetItem(organizationId, project.Id, "professional", "Town planner and land surveyor", 1, 145_000m, "approved"),
                BudgetItem(organizationId, project.Id, "municipal", "Bulk services contribution", 8, 18_500m, "estimate"),
                BudgetItem(organizationId, project.Id, "construction", "Superstructure and roofing", 280, 13_500m, "estimate"));

            database.ProjectContacts.AddRange(
                new ProjectContact { OrganizationId = organizationId, ProjectId = project.Id, Role = "Conveyancing attorney", Name = "Mokoena Attorneys", Phone = "+27 12 555 0181", Email = "transfers@mokoena.example", Status = "active" },
                new ProjectContact { OrganizationId = organizationId, ProjectId = project.Id, Role = "Town planner", Name = "Sibanda Planning", Phone = "+27 12 555 0142", Email = "planning@sibanda.example", Status = "active" },
                new ProjectContact { OrganizationId = organizationId, ProjectId = project.Id, Role = "Principal contractor", Name = "Tshwane Build Co", Phone = "+27 12 555 0119", Email = "site@tshwanebuild.example", Status = "pending" });

            database.ProjectDecisions.AddRange(
                new ProjectDecision { OrganizationId = organizationId, ProjectId = project.Id, DecidedAt = new DateOnly(2026, 2, 12), Decision = "Proceed to offer at asking price", Rationale = "Yield at 85% occupancy clears the 9% investment floor.", Impact = "Locks acquisition budget for the phase.", CreatedAt = SeedTimestamp },
                new ProjectDecision { OrganizationId = organizationId, ProjectId = project.Id, DecidedAt = new DateOnly(2026, 4, 3), Decision = "Build bachelor units rather than one-bed", Rationale = "Higher unit count within the same footprint improves gross yield.", Impact = "Revised unit mix and bulk contribution estimate.", CreatedAt = SeedTimestamp });

            database.Milestones.AddRange(
                Milestone(organizationId, project.Id, "2026-03-01", "Offer to purchase signed", "COMPLETE", true),
                Milestone(organizationId, project.Id, "2026-05-15", "Transfer registered", "COMPLETE", true),
                Milestone(organizationId, project.Id, "2026-07-30", "Building plans approved", "IN_PROGRESS", true),
                Milestone(organizationId, project.Id, "2026-10-15", "Slab cast", "PENDING", false),
                Milestone(organizationId, project.Id, "2027-02-28", "First units occupied", "PENDING", true));
        }
    }

    private static ProjectBudgetItem BudgetItem(Guid organizationId, long projectId, string category, string item, decimal quantity, decimal unitCost, string status) => new()
    {
        OrganizationId = organizationId,
        ProjectId = projectId,
        Category = category,
        Item = item,
        Unit = quantity > 1 ? "unit" : "lump sum",
        Quantity = quantity,
        UnitCost = unitCost,
        TotalCost = quantity * unitCost,
        Status = status,
        CreatedAt = SeedTimestamp,
    };

    private static Milestone Milestone(Guid organizationId, long projectId, string targetDate, string name, string status, bool isMajor) => new()
    {
        OrganizationId = organizationId,
        ProjectId = projectId,
        TargetDate = targetDate,
        Name = name,
        Status = status,
        Owner = "First Generation Properties",
        IsMajor = isMajor,
        CreatedAt = SeedTimestamp,
    };

    private static async Task SeedCapitalContributionsAsync(FgpDbContext database, Guid organizationId, CancellationToken cancellationToken)
    {
        var memberships = await database.Memberships
            .Where(item => item.OrganizationId == organizationId && item.Status == MembershipStatus.Active)
            .OrderBy(item => item.Role)
            .ThenBy(item => item.Id)
            .ToListAsync(cancellationToken);

        var contributing = memberships.Where(item => item.Role != OrganizationRole.Viewer).ToList();
        if (contributing.Count == 0) return;

        var monthlyAmounts = new[] { 25_000m, 18_000m, 12_000m, 9_500m };
        for (var monthOffset = 0; monthOffset < 3; monthOffset++)
        {
            for (var index = 0; index < contributing.Count; index++)
            {
                var membership = contributing[index];
                database.CapitalContributions.Add(new CapitalContribution
                {
                    OrganizationId = organizationId,
                    MemberId = membership.Id,
                    RecordedByUserId = membership.UserId,
                    Amount = monthlyAmounts[index % monthlyAmounts.Length],
                    ContributionDate = new DateOnly(2026, 4 + monthOffset, 1),
                    Note = "Monthly contribution",
                    Status = CapitalFundStatuses.Posted,
                    VersionNumber = 1,
                    IsCurrent = true,
                    CreatedAt = SeedTimestamp.AddMonths(monthOffset),
                });
            }
        }
    }

    private static async Task ClearAsync(FgpDbContext database, Guid organizationId, CancellationToken cancellationToken)
    {
        var listingIds = await database.Listings
            .Where(item => item.OrganizationId == organizationId)
            .Select(item => item.Id)
            .ToListAsync(cancellationToken);

        var projectIds = await database.Projects
            .Where(item => item.OrganizationId == organizationId)
            .Select(item => item.Id)
            .ToListAsync(cancellationToken);

        database.Milestones.RemoveRange(await database.Milestones.Where(item => projectIds.Contains(item.ProjectId)).ToListAsync(cancellationToken));
        database.ProjectBudgetItems.RemoveRange(await database.ProjectBudgetItems.Where(item => projectIds.Contains(item.ProjectId)).ToListAsync(cancellationToken));
        database.ProjectContacts.RemoveRange(await database.ProjectContacts.Where(item => projectIds.Contains(item.ProjectId)).ToListAsync(cancellationToken));
        database.ProjectDecisions.RemoveRange(await database.ProjectDecisions.Where(item => projectIds.Contains(item.ProjectId)).ToListAsync(cancellationToken));
        database.ProjectCheckins.RemoveRange(await database.ProjectCheckins.Where(item => projectIds.Contains(item.ProjectId)).ToListAsync(cancellationToken));
        database.Projects.RemoveRange(await database.Projects.Where(item => item.OrganizationId == organizationId).ToListAsync(cancellationToken));
        await database.SaveChangesAsync(cancellationToken);

        database.ComplianceDocuments.RemoveRange(await database.ComplianceDocuments.Where(item => item.OrganizationId == organizationId).ToListAsync(cancellationToken));
        database.FeasibilityReports.RemoveRange(await database.FeasibilityReports.Where(item => listingIds.Contains(item.ListingId)).ToListAsync(cancellationToken));
        await database.SaveChangesAsync(cancellationToken);

        database.Listings.RemoveRange(await database.Listings.Where(item => item.OrganizationId == organizationId).ToListAsync(cancellationToken));
        database.CapitalContributions.RemoveRange(await database.CapitalContributions.Where(item => item.OrganizationId == organizationId).ToListAsync(cancellationToken));
        await database.SaveChangesAsync(cancellationToken);
    }
}
