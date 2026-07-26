using FGP.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FGP.Api.Migrations;

[DbContext(typeof(FgpDbContext))]
[Migration("202607250008_OrganizationScopedTariffs")]
public sealed class OrganizationScopedTariffs : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE tariffs ADD COLUMN organization_id uuid;
            ALTER TABLE tariffs DROP CONSTRAINT IF EXISTS tariffs_tariff_year_category_key;

            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM tariffs) AND NOT EXISTS (SELECT 1 FROM organizations) THEN
                    RAISE EXCEPTION 'Existing tariffs cannot be assigned because no organization exists';
                END IF;
            END $$;

            WITH first_organization AS (
                SELECT id
                FROM organizations
                ORDER BY created_at, id
                LIMIT 1
            )
            UPDATE tariffs
            SET organization_id = first_organization.id
            FROM first_organization;

            WITH first_organization AS (
                SELECT id
                FROM organizations
                ORDER BY created_at, id
                LIMIT 1
            )
            INSERT INTO tariffs (organization_id, tariff_year, category, data, updated_at)
            SELECT organization.id, tariff.tariff_year, tariff.category, tariff.data, tariff.updated_at
            FROM tariffs AS tariff
            CROSS JOIN first_organization
            CROSS JOIN organizations AS organization
            WHERE tariff.organization_id = first_organization.id
              AND organization.id <> first_organization.id;

            ALTER TABLE tariffs ALTER COLUMN organization_id SET NOT NULL;
            ALTER TABLE tariffs
                ADD CONSTRAINT tariffs_organization_id_fkey
                FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
            CREATE UNIQUE INDEX tariffs_organization_year_category_key
                ON tariffs (organization_id, tariff_year, category);
            CREATE INDEX tariffs_organization_id_tariff_year_idx
                ON tariffs (organization_id, tariff_year);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DELETE FROM tariffs AS duplicate
            USING tariffs AS retained
            WHERE duplicate.tariff_year = retained.tariff_year
              AND duplicate.category = retained.category
              AND duplicate.id > retained.id;

            DROP INDEX IF EXISTS tariffs_organization_id_tariff_year_idx;
            DROP INDEX IF EXISTS tariffs_organization_year_category_key;
            ALTER TABLE tariffs DROP CONSTRAINT IF EXISTS tariffs_organization_id_fkey;
            ALTER TABLE tariffs DROP COLUMN IF EXISTS organization_id;
            ALTER TABLE tariffs
                ADD CONSTRAINT tariffs_tariff_year_category_key UNIQUE (tariff_year, category);
            """);
    }
}
