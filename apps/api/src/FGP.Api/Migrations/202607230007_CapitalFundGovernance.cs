using FGP.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FGP.Api.Migrations;

[DbContext(typeof(FgpDbContext))]
[Migration("202607230007_CapitalFundGovernance")]
public sealed class CapitalFundGovernance : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE capital_contributions (
                id BIGSERIAL PRIMARY KEY,
                organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
                member_id uuid NOT NULL REFERENCES organization_memberships(id) ON DELETE RESTRICT,
                recorded_by_user_id uuid NOT NULL REFERENCES "AspNetUsers"("Id") ON DELETE RESTRICT,
                amount numeric NOT NULL CHECK (amount > 0), contribution_date date NOT NULL, note text,
                status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','corrected','removed')),
                created_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX capital_contributions_organization_id_idx ON capital_contributions (organization_id, contribution_date DESC);

            CREATE TABLE capital_goal_proposals (
                id BIGSERIAL PRIMARY KEY,
                organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
                proposed_by_membership_id uuid NOT NULL REFERENCES organization_memberships(id) ON DELETE RESTRICT,
                new_amount numeric NOT NULL CHECK (new_amount > 0),
                status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','applied','withdrawn','voided')),
                submitted_at timestamptz NOT NULL DEFAULT now(), terminal_at timestamptz
            );
            CREATE UNIQUE INDEX capital_goal_one_open_per_organization_idx ON capital_goal_proposals (organization_id) WHERE status = 'open';
            CREATE TABLE capital_goal_electorate (
                proposal_id bigint NOT NULL REFERENCES capital_goal_proposals(id) ON DELETE CASCADE,
                membership_id uuid NOT NULL REFERENCES organization_memberships(id) ON DELETE RESTRICT,
                PRIMARY KEY (proposal_id, membership_id)
            );
            CREATE TABLE capital_goal_approvals (
                proposal_id bigint NOT NULL REFERENCES capital_goal_proposals(id) ON DELETE CASCADE,
                membership_id uuid NOT NULL REFERENCES organization_memberships(id) ON DELETE RESTRICT,
                approval_kind text NOT NULL CHECK (approval_kind IN ('AssentBySubmission','IndependentApproval')),
                approved_at timestamptz NOT NULL DEFAULT now(),
                PRIMARY KEY (proposal_id, membership_id)
            );

            CREATE TABLE capital_correction_proposals (
                id BIGSERIAL PRIMARY KEY,
                organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
                contribution_id bigint NOT NULL REFERENCES capital_contributions(id) ON DELETE RESTRICT,
                proposed_by_membership_id uuid NOT NULL REFERENCES organization_memberships(id) ON DELETE RESTRICT,
                action text NOT NULL CHECK (action IN ('edit','remove')),
                proposed_amount numeric CHECK (proposed_amount IS NULL OR proposed_amount > 0), proposed_note text,
                status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','applied','withdrawn','rejected')),
                submitted_at timestamptz NOT NULL DEFAULT now(), terminal_at timestamptz
            );
            CREATE TABLE capital_correction_approvals (
                proposal_id bigint NOT NULL REFERENCES capital_correction_proposals(id) ON DELETE CASCADE,
                approver_membership_id uuid NOT NULL REFERENCES organization_memberships(id) ON DELETE RESTRICT,
                approved_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (proposal_id, approver_membership_id)
            );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DROP TABLE IF EXISTS capital_correction_approvals; DROP TABLE IF EXISTS capital_correction_proposals;
        DROP TABLE IF EXISTS capital_goal_approvals; DROP TABLE IF EXISTS capital_goal_electorate;
        DROP TABLE IF EXISTS capital_goal_proposals; DROP TABLE IF EXISTS capital_contributions;
        """);
}
