using FGP.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FGP.Api.Migrations;

[DbContext(typeof(FgpDbContext))]
[Migration("202607230004_ScrapeJobsParity")]
public sealed class ScrapeJobsParity : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE scrape_jobs (
                id BIGSERIAL PRIMARY KEY,
                source TEXT NOT NULL,
                search_params JSONB,
                status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'complete', 'failed')),
                listings_found INTEGER DEFAULT 0,
                listings_new INTEGER DEFAULT 0,
                error_message TEXT,
                started_at TIMESTAMPTZ,
                completed_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DROP TABLE IF EXISTS scrape_jobs;");
    }
}
