using FGP.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FGP.Api.Migrations;

[DbContext(typeof(FgpDbContext))]
[Migration("202607230005_OrganizationScopedPortalData")]
public sealed class OrganizationScopedPortalData : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE listings ADD COLUMN organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT;
            ALTER TABLE feasibility_reports ADD COLUMN organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT;
            ALTER TABLE compliance_documents ADD COLUMN organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT;
            ALTER TABLE scrape_jobs ADD COLUMN organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT;
            ALTER TABLE projects ADD COLUMN organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT;
            ALTER TABLE project_budget_items ADD COLUMN organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT;
            ALTER TABLE project_contacts ADD COLUMN organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT;
            ALTER TABLE project_decisions ADD COLUMN organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT;
            ALTER TABLE project_checkins ADD COLUMN organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT;
            ALTER TABLE milestones ADD COLUMN organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT;

            CREATE INDEX listings_organization_id_idx ON listings (organization_id);
            CREATE INDEX feasibility_reports_organization_id_idx ON feasibility_reports (organization_id);
            CREATE INDEX compliance_documents_organization_id_idx ON compliance_documents (organization_id);
            CREATE INDEX scrape_jobs_organization_id_idx ON scrape_jobs (organization_id);
            CREATE INDEX projects_organization_id_idx ON projects (organization_id);
            CREATE INDEX project_budget_items_organization_id_idx ON project_budget_items (organization_id);
            CREATE INDEX project_contacts_organization_id_idx ON project_contacts (organization_id);
            CREATE INDEX project_decisions_organization_id_idx ON project_decisions (organization_id);
            CREATE INDEX project_checkins_organization_id_idx ON project_checkins (organization_id);
            CREATE INDEX milestones_organization_id_idx ON milestones (organization_id);

            CREATE TABLE organization_settings (
                organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                key text NOT NULL,
                value jsonb NOT NULL,
                updated_by_user_id uuid REFERENCES "AspNetUsers"("Id") ON DELETE SET NULL,
                updated_at timestamptz NOT NULL DEFAULT NOW(),
                PRIMARY KEY (organization_id, key)
            );

            CREATE TABLE activity_events (
                id BIGSERIAL PRIMARY KEY,
                organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                actor_user_id uuid REFERENCES "AspNetUsers"("Id") ON DELETE SET NULL,
                actor_name text,
                event_type text NOT NULL,
                title text NOT NULL,
                detail text,
                entity_type text,
                entity_id text,
                created_at timestamptz NOT NULL DEFAULT NOW()
            );
            CREATE INDEX activity_events_organization_id_created_at_idx ON activity_events (organization_id, created_at DESC);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TABLE IF EXISTS activity_events;
            DROP TABLE IF EXISTS organization_settings;
            ALTER TABLE milestones DROP COLUMN IF EXISTS organization_id;
            ALTER TABLE project_checkins DROP COLUMN IF EXISTS organization_id;
            ALTER TABLE project_decisions DROP COLUMN IF EXISTS organization_id;
            ALTER TABLE project_contacts DROP COLUMN IF EXISTS organization_id;
            ALTER TABLE project_budget_items DROP COLUMN IF EXISTS organization_id;
            ALTER TABLE projects DROP COLUMN IF EXISTS organization_id;
            ALTER TABLE scrape_jobs DROP COLUMN IF EXISTS organization_id;
            ALTER TABLE compliance_documents DROP COLUMN IF EXISTS organization_id;
            ALTER TABLE feasibility_reports DROP COLUMN IF EXISTS organization_id;
            ALTER TABLE listings DROP COLUMN IF EXISTS organization_id;
            """);
    }
}
