using FGP.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FGP.Api.Migrations;

[DbContext(typeof(FgpDbContext))]
[Migration("202607230003_OrganizationInvitations")]
public sealed class OrganizationInvitations : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE organization_invitations (
                id uuid PRIMARY KEY,
                organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                email text NOT NULL,
                role text NOT NULL CHECK (role IN ('Chairperson', 'Treasurer', 'Analyst', 'Viewer')),
                invited_by_user_id uuid NOT NULL REFERENCES "AspNetUsers"("Id") ON DELETE RESTRICT,
                token_hash bytea NOT NULL UNIQUE,
                expires_at timestamptz NOT NULL,
                accepted_at timestamptz,
                revoked_at timestamptz,
                created_at timestamptz NOT NULL DEFAULT NOW()
            );
            CREATE UNIQUE INDEX organization_invitations_one_open_per_email_idx
                ON organization_invitations (organization_id, email)
                WHERE accepted_at IS NULL AND revoked_at IS NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DROP TABLE IF EXISTS organization_invitations;");
    }
}
