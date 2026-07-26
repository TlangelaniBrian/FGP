using FGP.Api.Data;
using FGP.Api.Data.Entities;
using FGP.Api.Identity;
using FGP.Api.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace FGP.Api.Tests;

public sealed class TariffEndpointTests
{
    [Fact]
    public async Task Tariff_schema_requires_organization_ownership_and_scoped_uniqueness()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        await database.Database.OpenConnectionAsync();
        await using var command = database.Database.GetDbConnection().CreateCommand();
        command.CommandText = """
            SELECT
                EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'tariffs'
                      AND column_name = 'organization_id'
                      AND is_nullable = 'NO'
                )
                AND EXISTS (
                    SELECT 1
                    FROM pg_indexes
                    WHERE tablename = 'tariffs'
                      AND indexdef LIKE 'CREATE UNIQUE INDEX%'
                      AND indexdef LIKE '%(organization_id, tariff_year, category)%'
                )
            """;

        Assert.True((bool)(await command.ExecuteScalarAsync())!);
    }

    [Fact]
    public async Task Tariff_routes_require_authentication()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();

        using var read = await client.GetAsync("/api/tariffs?year=2026");
        using var write = await client.PutAsJsonAsync("/api/tariffs", BuildRatesRequest());

        Assert.Equal(HttpStatusCode.Unauthorized, read.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, write.StatusCode);
    }

    [Fact]
    public async Task Owner_can_upsert_and_read_only_the_claimed_organization_tariffs()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        var actor = await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        var otherOrganizationId = await AddEarlierMembershipAsync(app, actor);

        using var write = await client.PutAsJsonAsync("/api/tariffs", BuildRatesRequest());

        Assert.Equal(HttpStatusCode.OK, write.StatusCode);
        using var writePayload = JsonDocument.Parse(await write.Content.ReadAsStringAsync());
        Assert.Equal(2026, writePayload.RootElement.GetProperty("tariffYear").GetInt32());
        Assert.Equal("build_rates", writePayload.RootElement.GetProperty("category").GetString());
        Assert.Equal(13500m, writePayload.RootElement.GetProperty("data").GetProperty("bachelor").GetDecimal());
        Assert.False(writePayload.RootElement.TryGetProperty("organizationId", out _));

        using var updated = await client.PutAsJsonAsync("/api/tariffs", BuildRatesRequest(13_750m));

        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        using var updatedPayload = JsonDocument.Parse(await updated.Content.ReadAsStringAsync());
        Assert.Equal(13_750m, updatedPayload.RootElement.GetProperty("data").GetProperty("bachelor").GetDecimal());

        await using (var scope = app.Services.CreateAsyncScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
            var claimed = await database.Tariffs.SingleAsync();
            Assert.Equal(
                actor.OrganizationId,
                database.Entry(claimed).Property<Guid>("OrganizationId").CurrentValue);

            var foreign = new Tariff
            {
                TariffYear = 2026,
                Category = "fees",
                Data = JsonDocument.Parse("""{"professional_fee_pct":0.14}"""),
                UpdatedAt = DateTimeOffset.UtcNow,
            };
            database.Tariffs.Add(foreign);
            database.Entry(foreign).Property<Guid>("OrganizationId").CurrentValue = otherOrganizationId;
            await database.SaveChangesAsync();
        }

        using var read = await client.GetAsync("/api/tariffs?year=2026");

        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        using var readPayload = JsonDocument.Parse(await read.Content.ReadAsStringAsync());
        Assert.Equal(2026, readPayload.RootElement.GetProperty("year").GetInt32());
        var tariffs = readPayload.RootElement.GetProperty("tariffs");
        Assert.Equal(13_750m, tariffs.GetProperty("build_rates").GetProperty("bachelor").GetDecimal());
        Assert.False(tariffs.TryGetProperty("fees", out _));
    }

    [Fact]
    public async Task Authenticated_viewer_can_read_tariffs()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        var actor = await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        await SetRoleAsync(app, actor, OrganizationRole.Viewer);

        using var response = await client.GetAsync("/api/tariffs?year=2026");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var payload = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(2026, payload.RootElement.GetProperty("year").GetInt32());
        Assert.Empty(payload.RootElement.GetProperty("tariffs").EnumerateObject());
    }

    [Theory]
    [InlineData(OrganizationRole.Viewer)]
    [InlineData(OrganizationRole.Analyst)]
    public async Task Viewer_and_analyst_cannot_update_tariffs(OrganizationRole role)
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        var actor = await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        await SetRoleAsync(app, actor, role);

        using var response = await client.PutAsJsonAsync("/api/tariffs", BuildRatesRequest());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Tariff_update_rejects_invalid_year_and_category_payloads()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);

        using var invalidYear = await client.PutAsJsonAsync("/api/tariffs", new
        {
            year = 2031,
            category = "build_rates",
            data = UnitValues(),
        });
        using var invalidFees = await client.PutAsJsonAsync("/api/tariffs", new
        {
            year = 2026,
            category = "fees",
            data = new { professional_fee_pct = 0.31m },
        });
        using var invalidUnits = await client.PutAsJsonAsync("/api/tariffs", new
        {
            year = 2026,
            category = "unit_sizes",
            data = new { bachelor = 35m, luxury = 100m },
        });

        Assert.Equal(HttpStatusCode.UnprocessableEntity, invalidYear.StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, invalidFees.StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, invalidUnits.StatusCode);
    }

    [Fact]
    public async Task Concurrent_first_tariff_writes_are_atomic()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        var actor = await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        app.DatabaseInterceptor.ArmTariffReadBarrier(2);

        var responses = await Task.WhenAll(
            client.PutAsJsonAsync("/api/tariffs", BuildRatesRequest(13_500m)),
            client.PutAsJsonAsync("/api/tariffs", BuildRatesRequest(13_750m)));

        Assert.All(responses, response => Assert.Equal(HttpStatusCode.OK, response.StatusCode));
        foreach (var response in responses)
        {
            response.Dispose();
        }
        app.DatabaseInterceptor.DisarmTariffReadBarrier();

        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        var stored = await database.Tariffs
            .Where(tariff =>
                tariff.OrganizationId == actor.OrganizationId &&
                tariff.TariffYear == 2026 &&
                tariff.Category == "build_rates")
            .SingleAsync();
        var bachelor = stored.Data.RootElement.GetProperty("bachelor").GetDecimal();
        Assert.True(bachelor is 13_500m or 13_750m);
    }

    private static object BuildRatesRequest(decimal bachelor = 13_500m) => new
    {
        year = 2026,
        category = "build_rates",
        data = UnitValues(bachelor),
    };

    private static Dictionary<string, decimal> UnitValues(decimal bachelor = 13_500m) => new()
    {
        ["bachelor"] = bachelor,
        ["1bed"] = 14_200m,
        ["2bed"] = 15_000m,
        ["luxury"] = 18_500m,
    };

    private static async Task<Guid> AddEarlierMembershipAsync(IdentityApiFactory app, ContractActor actor)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        var claimedMembership = await database.Memberships.SingleAsync(candidate =>
            candidate.UserId == actor.UserId &&
            candidate.OrganizationId == actor.OrganizationId);
        var otherOrganization = new Organization
        {
            Id = Guid.NewGuid(),
            Name = "Earlier organization",
            CreatedAt = claimedMembership.CreatedAt.AddDays(-1),
        };
        database.Organizations.Add(otherOrganization);
        database.Memberships.Add(new Membership
        {
            Id = Guid.NewGuid(),
            OrganizationId = otherOrganization.Id,
            UserId = actor.UserId,
            Role = OrganizationRole.Owner,
            Status = MembershipStatus.Active,
            CreatedAt = claimedMembership.CreatedAt.AddMinutes(-1),
            ActivatedAt = claimedMembership.ActivatedAt?.AddMinutes(-1),
        });
        await database.SaveChangesAsync();
        return otherOrganization.Id;
    }

    private static async Task SetRoleAsync(
        IdentityApiFactory app,
        ContractActor actor,
        OrganizationRole role)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        var membership = await database.Memberships.SingleAsync(candidate =>
            candidate.UserId == actor.UserId &&
            candidate.OrganizationId == actor.OrganizationId);
        membership.Role = role;
        await database.SaveChangesAsync();
    }
}
