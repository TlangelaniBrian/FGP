using FGP.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FGP.Api.Migrations;

[DbContext(typeof(FgpDbContext))]
[Migration("202607230006_FeasibilityDecisionEvidence")]
public sealed class FeasibilityDecisionEvidence : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE feasibility_reports
                ADD COLUMN actual_units INTEGER,
                ADD COLUMN decision_status TEXT,
                ADD COLUMN zoning_evidence_available BOOLEAN,
                ADD COLUMN capacity_density_units INTEGER,
                ADD COLUMN capacity_far_units INTEGER,
                ADD COLUMN capacity_footprint_storey_units INTEGER;

            UPDATE feasibility_reports
            SET actual_units = LEAST(target_units, COALESCE(max_units_allowed, target_units)),
                decision_status = 'degraded',
                zoning_evidence_available = FALSE
            WHERE actual_units IS NULL OR decision_status IS NULL OR zoning_evidence_available IS NULL;

            ALTER TABLE feasibility_reports
                ALTER COLUMN actual_units SET NOT NULL,
                ALTER COLUMN decision_status SET NOT NULL,
                ALTER COLUMN decision_status SET DEFAULT 'degraded',
                ALTER COLUMN zoning_evidence_available SET NOT NULL,
                ALTER COLUMN zoning_evidence_available SET DEFAULT FALSE,
                ADD CONSTRAINT feasibility_reports_decision_status_check CHECK (decision_status IN ('definitive', 'degraded'));
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE feasibility_reports DROP CONSTRAINT IF EXISTS feasibility_reports_decision_status_check;
            ALTER TABLE feasibility_reports DROP COLUMN IF EXISTS capacity_footprint_storey_units;
            ALTER TABLE feasibility_reports DROP COLUMN IF EXISTS capacity_far_units;
            ALTER TABLE feasibility_reports DROP COLUMN IF EXISTS capacity_density_units;
            ALTER TABLE feasibility_reports DROP COLUMN IF EXISTS zoning_evidence_available;
            ALTER TABLE feasibility_reports DROP COLUMN IF EXISTS decision_status;
            ALTER TABLE feasibility_reports DROP COLUMN IF EXISTS actual_units;
            """);
    }
}
