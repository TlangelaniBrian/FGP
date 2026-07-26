using FGP.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FGP.Api.Migrations;

[DbContext(typeof(FgpDbContext))]
[Migration("202607260009_CapitalFundGovernanceHardening")]
public sealed class CapitalFundGovernanceHardening : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE capital_contributions
                ADD COLUMN root_contribution_id bigint REFERENCES capital_contributions(id) ON DELETE RESTRICT,
                ADD COLUMN supersedes_contribution_id bigint REFERENCES capital_contributions(id) ON DELETE RESTRICT,
                ADD COLUMN version_number integer NOT NULL DEFAULT 1 CHECK (version_number > 0),
                ADD COLUMN is_current boolean NOT NULL DEFAULT true;
            CREATE INDEX capital_contributions_current_idx
                ON capital_contributions (organization_id, is_current, contribution_date DESC);
            CREATE UNIQUE INDEX capital_contributions_current_root_idx
                ON capital_contributions (organization_id, (COALESCE(root_contribution_id, id)))
                WHERE is_current;

            CREATE TABLE capital_governance_audit_events (
                id BIGSERIAL PRIMARY KEY,
                organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
                actor_user_id uuid REFERENCES "AspNetUsers"("Id") ON DELETE SET NULL,
                event_type text NOT NULL,
                entity_type text NOT NULL,
                entity_id bigint,
                membership_event_id bigint REFERENCES activity_events(id) ON DELETE RESTRICT,
                details text,
                created_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX capital_governance_audit_events_organization_idx
                ON capital_governance_audit_events (organization_id, created_at DESC);
            CREATE FUNCTION prevent_capital_governance_audit_mutation()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            BEGIN
                RAISE EXCEPTION 'capital governance audit events are immutable';
            END;
            $$;
            CREATE TRIGGER capital_governance_audit_events_immutable
                BEFORE UPDATE OR DELETE ON capital_governance_audit_events
                FOR EACH ROW EXECUTE FUNCTION prevent_capital_governance_audit_mutation();
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Rollback removes the schema objects only; it cannot reconstruct corrected or removed ledger rows.
        migrationBuilder.Sql("""
            DROP TRIGGER IF EXISTS capital_governance_audit_events_immutable ON capital_governance_audit_events;
            DROP FUNCTION IF EXISTS prevent_capital_governance_audit_mutation();
            DROP TABLE IF EXISTS capital_governance_audit_events;
            DROP INDEX IF EXISTS capital_contributions_current_root_idx;
            DROP INDEX IF EXISTS capital_contributions_current_idx;
            ALTER TABLE capital_contributions
                DROP COLUMN IF EXISTS is_current,
                DROP COLUMN IF EXISTS version_number,
                DROP COLUMN IF EXISTS supersedes_contribution_id,
                DROP COLUMN IF EXISTS root_contribution_id;
            """);
    }
}
