using FGP.Api.Data.Entities;
using FGP.Api.Identity;
using FGP.Api.Organizations;
using FGP.Api.CapitalFund;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FGP.Api.Data;

public sealed class FgpDbContext(DbContextOptions<FgpDbContext> options) : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<Parcel> Parcels => Set<Parcel>();
    public DbSet<ZoningDesignation> ZoningDesignations => Set<ZoningDesignation>();
    public DbSet<ZoningSchemeRule> ZoningSchemeRules => Set<ZoningSchemeRule>();
    public DbSet<DolomiteZone> DolomiteZones => Set<DolomiteZone>();
    public DbSet<LandUseHexagon> LandUseHexagons => Set<LandUseHexagon>();
    public DbSet<Amenity> Amenities => Set<Amenity>();
    public DbSet<Listing> Listings => Set<Listing>();
    public DbSet<FeasibilityReport> FeasibilityReports => Set<FeasibilityReport>();
    public DbSet<ComplianceDocument> ComplianceDocuments => Set<ComplianceDocument>();
    public DbSet<ScrapeJob> ScrapeJobs => Set<ScrapeJob>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectBudgetItem> ProjectBudgetItems => Set<ProjectBudgetItem>();
    public DbSet<ProjectContact> ProjectContacts => Set<ProjectContact>();
    public DbSet<ProjectDecision> ProjectDecisions => Set<ProjectDecision>();
    public DbSet<ProjectCheckin> ProjectCheckins => Set<ProjectCheckin>();
    public DbSet<Milestone> Milestones => Set<Milestone>();
    public DbSet<Tariff> Tariffs => Set<Tariff>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<OrganizationInvitation> OrganizationInvitations => Set<OrganizationInvitation>();
    public DbSet<OrganizationSetting> OrganizationSettings => Set<OrganizationSetting>();
    public DbSet<ActivityEvent> ActivityEvents => Set<ActivityEvent>();
    public DbSet<CapitalContribution> CapitalContributions => Set<CapitalContribution>();
    public DbSet<CapitalGoalProposal> CapitalGoalProposals => Set<CapitalGoalProposal>();
    public DbSet<CapitalGoalElectorate> CapitalGoalElectorates => Set<CapitalGoalElectorate>();
    public DbSet<CapitalGoalApproval> CapitalGoalApprovals => Set<CapitalGoalApproval>();
    public DbSet<CapitalCorrectionProposal> CapitalCorrectionProposals => Set<CapitalCorrectionProposal>();
    public DbSet<CapitalCorrectionApproval> CapitalCorrectionApprovals => Set<CapitalCorrectionApproval>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<Parcel>(entity =>
        {
            entity.ToTable("parcels");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ErfNumber).HasColumnName("erf_number");
            entity.Property(x => x.SizeSqm).HasColumnName("size_sqm");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.Boundary).HasColumnType("geography (polygon,4326)");
            entity.Property(x => x.Centroid).HasColumnType("geography (point,4326)");
            entity.HasIndex(x => x.Boundary).HasDatabaseName("parcels_boundary_idx").HasMethod("gist");
            entity.HasIndex(x => x.Centroid).HasDatabaseName("parcels_centroid_idx").HasMethod("gist");
        });

        modelBuilder.Entity<ZoningDesignation>(entity =>
        {
            entity.ToTable("zoning_designations");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ZoneCode).HasColumnName("zone_code");
            entity.Property(x => x.ZoneLabel).HasColumnName("zone_label");
            entity.Property(x => x.SchemeYear).HasColumnName("scheme_year");
            entity.Property(x => x.SourceUrl).HasColumnName("source_url");
            entity.Property(x => x.LastUpdated).HasColumnName("last_updated");
            entity.Property(x => x.Geometry).HasColumnType("geography (multipolygon,4326)");
            entity.HasIndex(x => x.Geometry).HasDatabaseName("zoning_geometry_idx").HasMethod("gist");
        });

        modelBuilder.Entity<ZoningSchemeRule>(entity =>
        {
            entity.ToTable("zoning_scheme_rules");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ZoneCode).HasColumnName("zone_code");
            entity.Property(x => x.ZoneLabel).HasColumnName("zone_label");
            entity.Property(x => x.MaxUnitsPerHa).HasColumnName("max_units_per_ha");
            entity.Property(x => x.MaxUnitsPerErf).HasColumnName("max_units_per_erf");
            entity.Property(x => x.CoveragePct).HasColumnName("coverage_pct");
            entity.Property(x => x.MaxHeightM).HasColumnName("max_height_m");
            entity.Property(x => x.MaxStoreys).HasColumnName("max_storeys");
            entity.Property(x => x.BuildingLineFrontM).HasColumnName("building_line_front_m");
            entity.Property(x => x.BuildingLineSideM).HasColumnName("building_line_side_m");
            entity.Property(x => x.BuildingLineRearM).HasColumnName("building_line_rear_m");
            entity.Property(x => x.PermittedUses).HasColumnName("permitted_uses");
            entity.Property(x => x.ConsentUses).HasColumnName("consent_uses");
            entity.Property(x => x.RezoningPossibleTo).HasColumnName("rezoning_possible_to");
            entity.Property(x => x.RezoningDifficulty).HasColumnName("rezoning_difficulty");
            entity.Property(x => x.RezoningApprovalRate).HasColumnName("rezoning_approval_rate");
            entity.Property(x => x.FormsRequired).HasColumnName("forms_required");
            entity.Property(x => x.SchemeDocument).HasColumnName("scheme_document");
            entity.Property(x => x.SchemeYear).HasColumnName("scheme_year");
            entity.Property(x => x.LastUpdated).HasColumnName("last_updated");
            entity.HasIndex(x => new { x.Municipality, x.ZoneCode }).IsUnique();
        });

        modelBuilder.Entity<DolomiteZone>(entity =>
        {
            entity.ToTable("dolomite_zones");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.RiskClass).HasColumnName("risk_class");
            entity.Property(x => x.CgsReference).HasColumnName("cgs_reference");
            entity.Property(x => x.Geometry).HasColumnType("geography (multipolygon,4326)");
            entity.HasIndex(x => x.Geometry).HasDatabaseName("dolomite_geometry_idx").HasMethod("gist");
        });

        modelBuilder.Entity<LandUseHexagon>(entity =>
        {
            entity.ToTable("land_use_hexagons");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.H3Index).HasColumnName("h3_index");
            entity.Property(x => x.LandUseClass).HasColumnName("land_use_class");
            entity.Property(x => x.Pop2026Est).HasColumnName("pop_2026_est");
            entity.Property(x => x.SocioecoRisk).HasColumnName("socioeco_risk");
            entity.Property(x => x.NewDevFlag).HasColumnName("new_dev_flag");
            entity.HasIndex(x => x.H3Index).IsUnique();
            entity.Property(x => x.Geometry).HasColumnType("geography (polygon,4326)");
        });

        modelBuilder.Entity<Amenity>(entity =>
        {
            entity.ToTable("amenities");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Geometry).HasColumnType("geography (point,4326)");
            entity.HasIndex(x => x.Geometry).HasDatabaseName("amenities_geometry_idx").HasMethod("gist");
        });

        modelBuilder.Entity<Listing>(entity =>
        {
            entity.ToTable("listings");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.SourceId).HasColumnName("source_id");
            entity.Property(x => x.SourceUrl).HasColumnName("source_url");
            entity.Property(x => x.ScrapedAt).HasColumnName("scraped_at");
            entity.Property(x => x.SizeSqm).HasColumnName("size_sqm");
            entity.Property(x => x.PricePerSqm).HasColumnName("price_per_sqm").HasComputedColumnSql("CASE WHEN size_sqm > 0 THEN price / size_sqm ELSE NULL END", true);
            entity.Property(x => x.ListingType).HasColumnName("listing_type");
            entity.Property(x => x.ParcelId).HasColumnName("parcel_id");
            entity.Property(x => x.ZoneCode).HasColumnName("zone_code");
            entity.Property(x => x.DolomiteRisk).HasColumnName("dolomite_risk");
            entity.Property(x => x.FeasibilityScore).HasColumnName("feasibility_score");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.Coordinates).HasColumnType("geography (point,4326)");
        });

        modelBuilder.Entity<FeasibilityReport>(entity =>
        {
            entity.ToTable("feasibility_reports");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ListingId).HasColumnName("listing_id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.UnitType).HasColumnName("unit_type");
            entity.Property(x => x.TargetUnits).HasColumnName("target_units");
            entity.Property(x => x.ActualUnits).HasColumnName("actual_units");
            entity.Property(x => x.DecisionStatus).HasColumnName("decision_status");
            entity.Property(x => x.ZoningEvidenceAvailable).HasColumnName("zoning_evidence_available");
            entity.Property(x => x.CapacityDensityUnits).HasColumnName("capacity_density_units");
            entity.Property(x => x.CapacityFarUnits).HasColumnName("capacity_far_units");
            entity.Property(x => x.CapacityFootprintStoreyUnits).HasColumnName("capacity_footprint_storey_units");
            entity.Property(x => x.BuildRatePerSqm).HasColumnName("build_rate_per_sqm");
            entity.Property(x => x.TariffYear).HasColumnName("tariff_year");
            entity.Property(x => x.MaxUnitsAllowed).HasColumnName("max_units_allowed");
            entity.Property(x => x.MaxBuildableSqm).HasColumnName("max_buildable_sqm");
            entity.Property(x => x.MaxFootprintSqm).HasColumnName("max_footprint_sqm");
            entity.Property(x => x.RezoningRequired).HasColumnName("rezoning_required");
            entity.Property(x => x.CostLand).HasColumnName("cost_land");
            entity.Property(x => x.CostBuild).HasColumnName("cost_build");
            entity.Property(x => x.CostProfessionalFees).HasColumnName("cost_professional_fees");
            entity.Property(x => x.CostBulkContributions).HasColumnName("cost_bulk_contributions");
            entity.Property(x => x.CostTransferDuty).HasColumnName("cost_transfer_duty");
            entity.Property(x => x.CostTotal).HasColumnName("cost_total");
            entity.Property(x => x.RentPerUnitMonthly).HasColumnName("rent_per_unit_monthly");
            entity.Property(x => x.GrossMonthlyIncome).HasColumnName("gross_monthly_income");
            entity.Property(x => x.GrossAnnualIncome).HasColumnName("gross_annual_income");
            entity.Property(x => x.YieldGrossPct).HasColumnName("yield_gross_pct");
            entity.Property(x => x.YieldAt85OccPct).HasColumnName("yield_at_85_occ_pct");
            entity.Property(x => x.ViabilityNotes).HasColumnName("viability_notes");
            entity.Property(x => x.ScoreSchools).HasColumnName("score_schools");
            entity.Property(x => x.ScoreTransport).HasColumnName("score_transport");
            entity.Property(x => x.ScoreAmenities).HasColumnName("score_amenities");
            entity.Property(x => x.PdfPackageUrl).HasColumnName("pdf_package_url");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<ComplianceDocument>(entity =>
        {
            entity.ToTable("compliance_documents");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ReportId).HasColumnName("report_id");
            entity.Property(x => x.ListingId).HasColumnName("listing_id");
            entity.Property(x => x.DocType).HasColumnName("doc_type");
            entity.Property(x => x.PrefilledData).HasColumnName("prefilled_data").HasColumnType("jsonb");
            entity.Property(x => x.PdfUrl).HasColumnName("pdf_url");
            entity.Property(x => x.SubmittedAt).HasColumnName("submitted_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<ScrapeJob>(entity =>
        {
            entity.ToTable("scrape_jobs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.SearchParams).HasColumnName("search_params").HasColumnType("jsonb");
            entity.Property(x => x.ListingsFound).HasColumnName("listings_found");
            entity.Property(x => x.ListingsNew).HasColumnName("listings_new");
            entity.Property(x => x.ErrorMessage).HasColumnName("error_message");
            entity.Property(x => x.StartedAt).HasColumnName("started_at");
            entity.Property(x => x.CompletedAt).HasColumnName("completed_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        ConfigureProjectEntities(modelBuilder);
        ConfigureTariff(modelBuilder);
        ConfigureOrganizations(modelBuilder);
        ConfigureCapitalFund(modelBuilder);
        ConfigureTenantOwnership(modelBuilder);
        UseSnakeCaseColumns(modelBuilder);

        modelBuilder.Entity<LandUseHexagon>().Property(x => x.H3Index).HasColumnName("h3_index");
        modelBuilder.Entity<LandUseHexagon>().Property(x => x.Pop2026Est).HasColumnName("pop_2026_est");
        modelBuilder.Entity<Milestone>().Property(x => x.Name).HasColumnName("milestone");
    }

    private static void ConfigureProjectEntities(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Project>(entity =>
        {
            entity.ToTable("projects");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.ListingId).HasColumnName("listing_id");
            entity.Property(x => x.ReportId).HasColumnName("report_id");
            entity.Property(x => x.ErfNumber).HasColumnName("erf_number");
            entity.Property(x => x.MonthlySavingZar).HasColumnName("monthly_saving_zar");
            entity.Property(x => x.Phase1TargetZar).HasColumnName("phase1_target_zar");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<ProjectBudgetItem>(entity =>
        {
            entity.ToTable("project_budget_items");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ProjectId).HasColumnName("project_id");
            entity.Property(x => x.UnitCost).HasColumnName("unit_cost");
            entity.Property(x => x.TotalCost).HasColumnName("total_cost");
            entity.Property(x => x.ActualCost).HasColumnName("actual_cost");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<ProjectContact>(entity =>
        {
            entity.ToTable("project_contacts");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ProjectId).HasColumnName("project_id");
        });

        modelBuilder.Entity<ProjectDecision>(entity =>
        {
            entity.ToTable("project_decisions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ProjectId).HasColumnName("project_id");
            entity.Property(x => x.DecidedAt).HasColumnName("decided_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<ProjectCheckin>(entity =>
        {
            entity.ToTable("project_checkins");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ProjectId).HasColumnName("project_id");
            entity.Property(x => x.WeekOf).HasColumnName("week_of");
            entity.Property(x => x.AttorneyStatus).HasColumnName("attorney_status");
            entity.Property(x => x.SavingsConfirmed).HasColumnName("savings_confirmed");
            entity.Property(x => x.DepositZar).HasColumnName("deposit_zar");
            entity.Property(x => x.SupplierProgress).HasColumnName("supplier_progress");
            entity.Property(x => x.OpenIssues).HasColumnName("open_issues");
            entity.Property(x => x.ActionsNextCall).HasColumnName("actions_next_call");
            entity.Property(x => x.DecisionsNeeded).HasColumnName("decisions_needed");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<Milestone>(entity =>
        {
            entity.ToTable("milestones");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ProjectId).HasColumnName("project_id");
            entity.Property(x => x.TargetDate).HasColumnName("target_date");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        });
    }

    private static void ConfigureTariff(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Tariff>(entity =>
        {
            entity.ToTable("tariffs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.TariffYear).HasColumnName("tariff_year");
            entity.Property(x => x.Data).HasColumnType("jsonb");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.TariffYear, x.Category }).IsUnique();
            entity.HasIndex(x => x.TariffYear).HasDatabaseName("tariffs_year_idx");
        });
    }

    private static void ConfigureOrganizations(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Organization>(entity =>
        {
            entity.ToTable("organizations");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<Membership>(entity =>
        {
            entity.ToTable("organization_memberships");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.OrganizationId).HasColumnName("organization_id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.InvitedByUserId).HasColumnName("invited_by_user_id");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.ActivatedAt).HasColumnName("activated_at");
            entity.Property(x => x.Role).HasConversion<string>();
            entity.Property(x => x.Status).HasConversion<string>();
            entity.HasIndex(x => new { x.OrganizationId, x.UserId }).IsUnique();
            entity.HasOne<Organization>()
                .WithMany()
                .HasForeignKey(x => x.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<OrganizationInvitation>(entity =>
        {
            entity.ToTable("organization_invitations");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.OrganizationId).HasColumnName("organization_id");
            entity.Property(x => x.InvitedByUserId).HasColumnName("invited_by_user_id");
            entity.Property(x => x.TokenHash).HasColumnName("token_hash");
            entity.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            entity.Property(x => x.AcceptedAt).HasColumnName("accepted_at");
            entity.Property(x => x.RevokedAt).HasColumnName("revoked_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.Role).HasConversion<string>();
            entity.HasIndex(x => x.TokenHash).IsUnique();
            entity.HasOne<Organization>()
                .WithMany()
                .HasForeignKey(x => x.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(x => x.InvitedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<OrganizationSetting>(entity =>
        {
            entity.ToTable("organization_settings");
            entity.HasKey(x => new { x.OrganizationId, x.Key });
            entity.Property(x => x.OrganizationId).HasColumnName("organization_id");
            entity.Property(x => x.UpdatedByUserId).HasColumnName("updated_by_user_id");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.Property(x => x.Value).HasColumnType("jsonb");
            entity.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.UpdatedByUserId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ActivityEvent>(entity =>
        {
            entity.ToTable("activity_events");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.OrganizationId).HasColumnName("organization_id");
            entity.Property(x => x.ActorUserId).HasColumnName("actor_user_id");
            entity.Property(x => x.ActorName).HasColumnName("actor_name");
            entity.Property(x => x.EventType).HasColumnName("event_type");
            entity.Property(x => x.EntityType).HasColumnName("entity_type");
            entity.Property(x => x.EntityId).HasColumnName("entity_id");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.OrganizationId, x.CreatedAt });
            entity.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.ActorUserId).OnDelete(DeleteBehavior.SetNull);
        });
    }

    private static void ConfigureCapitalFund(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CapitalContribution>().ToTable("capital_contributions").HasKey(x => x.Id);
        modelBuilder.Entity<CapitalGoalProposal>().ToTable("capital_goal_proposals").HasKey(x => x.Id);
        modelBuilder.Entity<CapitalGoalElectorate>().ToTable("capital_goal_electorate").HasKey(x => new { x.ProposalId, x.MembershipId });
        modelBuilder.Entity<CapitalGoalApproval>().ToTable("capital_goal_approvals").HasKey(x => new { x.ProposalId, x.MembershipId });
        modelBuilder.Entity<CapitalCorrectionProposal>().ToTable("capital_correction_proposals").HasKey(x => x.Id);
        modelBuilder.Entity<CapitalCorrectionApproval>().ToTable("capital_correction_approvals").HasKey(x => new { x.ProposalId, x.ApproverMembershipId });
    }

    private static void ConfigureTenantOwnership(ModelBuilder modelBuilder)
    {
        ConfigureTenantOwned<Listing>(modelBuilder);
        ConfigureTenantOwned<FeasibilityReport>(modelBuilder);
        ConfigureTenantOwned<ComplianceDocument>(modelBuilder);
        ConfigureTenantOwned<ScrapeJob>(modelBuilder);
        ConfigureTenantOwned<Project>(modelBuilder);
        ConfigureTenantOwned<ProjectBudgetItem>(modelBuilder);
        ConfigureTenantOwned<ProjectContact>(modelBuilder);
        ConfigureTenantOwned<ProjectDecision>(modelBuilder);
        ConfigureTenantOwned<ProjectCheckin>(modelBuilder);
        ConfigureTenantOwned<Milestone>(modelBuilder);
    }

    private static void ConfigureTenantOwned<TEntity>(ModelBuilder modelBuilder) where TEntity : class
    {
        modelBuilder.Entity<TEntity>(entity =>
        {
            entity.Property<Guid>("OrganizationId").HasColumnName("organization_id");
            entity.HasIndex("OrganizationId");
            entity.HasOne<Organization>().WithMany().HasForeignKey("OrganizationId").OnDelete(DeleteBehavior.Restrict);
        });
    }

    private static void UseSnakeCaseColumns(ModelBuilder modelBuilder)
    {
        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            if (entity.GetTableName()?.StartsWith("AspNet", StringComparison.Ordinal) == true) continue;

            foreach (var property in entity.GetProperties())
            {
                property.SetColumnName(ToSnakeCase(property.Name));
            }
        }
    }

    private static string ToSnakeCase(string value)
    {
        var result = new System.Text.StringBuilder(value.Length + 8);

        for (var index = 0; index < value.Length; index++)
        {
            var character = value[index];
            if (char.IsUpper(character) && index > 0 &&
                (char.IsLower(value[index - 1]) || char.IsDigit(value[index - 1]) ||
                 (index + 1 < value.Length && char.IsLower(value[index + 1]))))
            {
                result.Append('_');
            }

            result.Append(char.ToLowerInvariant(character));
        }

        return result.ToString();
    }
}

public static class FgpMigrator
{
    public static async Task ApplyAsync(string connectionString, CancellationToken cancellationToken = default)
    {
        var options = new DbContextOptionsBuilder<FgpDbContext>()
            .UseNpgsql(connectionString, npgsql => npgsql.UseNetTopologySuite())
            .Options;

        await using var database = new FgpDbContext(options);
        await database.Database.MigrateAsync(cancellationToken);
    }
}
