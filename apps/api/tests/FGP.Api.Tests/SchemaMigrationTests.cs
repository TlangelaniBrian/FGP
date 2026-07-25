using FGP.Api.Data;
using FGP.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite;
using NetTopologySuite.Geometries;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace FGP.Api.Tests;

public sealed class SchemaMigrationTests
{
    [Fact]
    public async Task Initial_migration_enables_postgis_and_creates_parcel_spatial_index()
    {
        await using var database = new PostgreSqlBuilder()
            .WithImage("postgis/postgis:15-3.4")
            .Build();

        await database.StartAsync();
        await FgpMigrator.ApplyAsync(database.GetConnectionString());

        await using var connection = new NpgsqlConnection(database.GetConnectionString());
        await connection.OpenAsync();

        Assert.True(await ScalarAsync<bool>(connection, "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis')"));
        Assert.True(await ScalarAsync<bool>(connection, "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'parcels_boundary_idx')"));
    }

    [Fact]
    public async Task Initial_migration_supports_spatial_parcel_writes_through_ef()
    {
        await using var database = new PostgreSqlBuilder()
            .WithImage("postgis/postgis:15-3.4")
            .Build();

        await database.StartAsync();
        await FgpMigrator.ApplyAsync(database.GetConnectionString());

        var options = new DbContextOptionsBuilder<FgpDbContext>()
            .UseNpgsql(database.GetConnectionString(), npgsql => npgsql.UseNetTopologySuite())
            .Options;
        var geometryFactory = NtsGeometryServices.Instance.CreateGeometryFactory(srid: 4326);

        await using (var context = new FgpDbContext(options))
        {
            context.Parcels.Add(new Parcel
            {
                ErfNumber = "ERF 1",
                Boundary = geometryFactory.CreatePolygon([
                    new Coordinate(28.0, -25.0),
                    new Coordinate(28.001, -25.0),
                    new Coordinate(28.001, -25.001),
                    new Coordinate(28.0, -25.0),
                ]),
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
            });

            await context.SaveChangesAsync();
        }

        await using var verificationContext = new FgpDbContext(options);
        Assert.Equal(1, await verificationContext.Parcels.CountAsync());
    }

    [Fact]
    public async Task Identity_migration_creates_organization_membership_schema()
    {
        await using var database = new PostgreSqlBuilder()
            .WithImage("postgis/postgis:15-3.4")
            .Build();

        await database.StartAsync();
        await FgpMigrator.ApplyAsync(database.GetConnectionString());

        await using var connection = new NpgsqlConnection(database.GetConnectionString());
        await connection.OpenAsync();

        Assert.True(await ScalarAsync<bool>(connection, "SELECT to_regclass('public.organizations') IS NOT NULL"));
        Assert.True(await ScalarAsync<bool>(connection, "SELECT to_regclass('public.organization_memberships') IS NOT NULL"));
        Assert.True(await ScalarAsync<bool>(connection, "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_memberships_organization_id_user_id_key')"));
    }

    private static async Task<T> ScalarAsync<T>(NpgsqlConnection connection, string commandText)
    {
        await using var command = new NpgsqlCommand(commandText, connection);
        return (T)(await command.ExecuteScalarAsync())!;
    }
}
