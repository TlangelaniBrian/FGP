using FGP.Api.Data;
using FGP.Api.Data.Entities;
using FGP.Api.Identity;
using FGP.Api.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Xunit;

namespace FGP.Api.Tests;

public sealed class FeasibilityContractTests
{
    [Theory]
    [InlineData("/api/feasibility")]
    [InlineData("/api/feasibility/save")]
    public async Task Feasibility_routes_require_authentication_without_calling_the_worker(string path)
    {
        await using var app = await IdentityApiFactory.CreateAsync();

        var response = await app.CreateClient().PostAsync(
            path,
            JsonContent(ContractTestSession.ValidFeasibilityRequest));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(0, app.WorkerClient.CallCount);
    }

    [Fact]
    public async Task Feasibility_preserves_numerical_results_zone_rules_and_sub_ten_second_timings()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        await AddZoneRuleAsync(app);
        var client = app.CreateClient();
        var actor = await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        app.WorkerClient.Delay = TimeSpan.FromMilliseconds(20);
        app.WorkerClient.Response = new(HttpStatusCode.OK, ContractTestSession.ValidFeasibilityResult);
        var timer = Stopwatch.StartNew();

        var response = await client.PostAsJsonAsync("/api/feasibility", ValidRequest());

        timer.Stop();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(timer.Elapsed < TimeSpan.FromSeconds(10), $"Feasibility request took {timer.Elapsed}.");
        Assert.Equal("/analyze/feasibility", app.WorkerClient.LastPath);
        var forwarded = app.WorkerClient.LastRequest!.RootElement;
        Assert.Equal(actor.OrganizationId, forwarded.GetProperty("organization_id").GetGuid());
        Assert.Equal("RES3", forwarded.GetProperty("zone_code").GetString());
        Assert.Equal(60m, forwarded.GetProperty("zone_rules").GetProperty("coverage_pct").GetDecimal());
        Assert.Equal(80, forwarded.GetProperty("zone_rules").GetProperty("max_units_per_ha").GetInt32());
        AssertTimingHeader(response);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(13500.25m, body.RootElement.GetProperty("build_rate_per_sqm").GetDecimal());
        Assert.Equal(2362543.75m, body.RootElement.GetProperty("cost_build").GetDecimal());
        Assert.Equal(7.24m, body.RootElement.GetProperty("yield_at_85_occ_pct").GetDecimal());
        Assert.Equal(5, body.RootElement.GetProperty("capacity").GetProperty("density_units").GetInt32());
    }

    [Fact]
    public async Task Feasibility_rejects_unknown_input_without_calling_the_worker()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);

        var response = await client.PostAsJsonAsync("/api/feasibility", new
        {
            address = "123 Test Street",
            municipality = "johannesburg",
            zone_code = "RES3",
            size_sqm = 1024,
            price = 980000,
            unit_type = "bachelor",
            target_units = 8,
            tariff_year = 2026,
            viable = true,
        });

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal(0, app.WorkerClient.CallCount);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(body.RootElement.TryGetProperty("error", out _));
    }

    [Fact]
    public async Task Feasibility_rejects_browser_supplied_organization_identity()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);

        var response = await client.PostAsJsonAsync("/api/feasibility", new
        {
            address = "123 Test Street",
            municipality = "johannesburg",
            zone_code = "RES3",
            size_sqm = 1024,
            price = 980000,
            unit_type = "bachelor",
            target_units = 8,
            tariff_year = 2026,
            organization_id = Guid.NewGuid(),
        });

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal(0, app.WorkerClient.CallCount);
    }

    [Theory]
    [InlineData("/api/feasibility", MembershipStatus.Suspended, HttpStatusCode.Unauthorized)]
    [InlineData("/api/feasibility", MembershipStatus.Removed, HttpStatusCode.Unauthorized)]
    [InlineData("/api/feasibility/save", MembershipStatus.Suspended, HttpStatusCode.Forbidden)]
    [InlineData("/api/feasibility/save", MembershipStatus.Removed, HttpStatusCode.Forbidden)]
    public async Task Feasibility_rejects_inactive_claim_membership_without_calling_worker(
        string path,
        MembershipStatus status,
        HttpStatusCode expectedStatus)
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        var actor = await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        await SetClaimedMembershipStatusAsync(app, actor, status);

        var response = await client.PostAsJsonAsync(path, ValidRequest());

        Assert.Equal(expectedStatus, response.StatusCode);
        Assert.Equal(0, app.WorkerClient.CallCount);
    }

    [Fact]
    public async Task Feasibility_rejects_out_of_range_input_without_calling_the_worker()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);

        var response = await client.PostAsJsonAsync("/api/feasibility", new
        {
            address = "",
            municipality = "johannesburg",
            zone_code = "RES 3!",
            size_sqm = 99,
            price = 9999,
            unit_type = "studio",
            target_units = 0,
            tariff_year = 2031,
        });

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal(0, app.WorkerClient.CallCount);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(body.RootElement.TryGetProperty("error", out var error));
        Assert.True(error.TryGetProperty("fieldErrors", out _));
    }

    [Theory]
    [MemberData(nameof(InvalidRequestJson))]
    public async Task Feasibility_rejects_case_variant_names_and_quoted_numbers(string json)
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);

        var response = await client.PostAsync("/api/feasibility", JsonContent(json));

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal(0, app.WorkerClient.CallCount);
    }

    [Fact]
    public async Task Feasibility_preserves_worker_rate_limit_as_429_error()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        app.WorkerClient.Response = new(HttpStatusCode.TooManyRequests, """
            {"detail":"Rate limit exceeded: 10 requests/minute"}
            """);

        var response = await client.PostAsJsonAsync("/api/feasibility", ValidRequest());

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("Rate limit exceeded: 10 requests/minute", body.RootElement.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Feasibility_maps_worker_failure_to_stable_503()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        app.WorkerClient.ExceptionToThrow = new HttpRequestException("secret connection details");

        var response = await client.PostAsJsonAsync("/api/feasibility", ValidRequest());

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("Analysis service is temporarily unavailable.", body.RootElement.GetProperty("error").GetString());
        AssertTimingHeader(response);
    }

    [Fact]
    public async Task Feasibility_rejects_structurally_invalid_worker_results_as_502()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        app.WorkerClient.Response = new(
            HttpStatusCode.OK,
            ContractTestSession.ValidFeasibilityResult.Replace(
                """
                  "capacity": {
                    "density_units": 5,
                    "far_units": 19,
                    "footprint_storey_units": 23
                  },
                """,
                """
                  "capacity": null,
                """,
                StringComparison.Ordinal));

        var response = await client.PostAsJsonAsync("/api/feasibility", ValidRequest());

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(
            "Worker returned an invalid feasibility result",
            body.RootElement.GetProperty("error").GetString());
    }

    [Theory]
    [MemberData(nameof(InvalidWorkerResultJson))]
    public async Task Feasibility_rejects_case_variant_names_and_quoted_numbers_from_worker(string workerResult)
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        app.WorkerClient.Response = new(HttpStatusCode.OK, workerResult);

        var response = await client.PostAsJsonAsync("/api/feasibility", ValidRequest());

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(
            "Worker returned an invalid feasibility result",
            body.RootElement.GetProperty("error").GetString());
    }

    [Theory]
    [InlineData("/api/feasibility")]
    [InlineData("/api/feasibility/save")]
    public async Task Feasibility_maps_zoning_lookup_failures_to_stable_503(string path)
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        app.DatabaseInterceptor.ZoningLookupException =
            new InvalidOperationException("secret zoning database details");

        var response = await client.PostAsJsonAsync(path, ValidRequest());

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("Zoning rules could not be loaded", body.RootElement.GetProperty("error").GetString());
        Assert.DoesNotContain("secret", await response.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
        Assert.Equal(0, app.WorkerClient.CallCount);
    }

    [Fact]
    public async Task Feasibility_endpoint_deadline_cancels_slow_zoning_lookup()
    {
        await using var app = await IdentityApiFactory.CreateAsync(TimeSpan.FromMilliseconds(100));
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        app.DatabaseInterceptor.ZoningLookupDelay = TimeSpan.FromSeconds(2);
        var timer = Stopwatch.StartNew();

        var response = await client.PostAsJsonAsync("/api/feasibility", ValidRequest());

        timer.Stop();
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.True(timer.Elapsed < TimeSpan.FromSeconds(1), $"Deadline response took {timer.Elapsed}.");
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(
            "Analysis service is temporarily unavailable.",
            body.RootElement.GetProperty("error").GetString());
        Assert.Equal(0, app.WorkerClient.CallCount);
    }

    [Fact]
    public async Task Feasibility_endpoint_deadline_cancels_and_rolls_back_slow_save()
    {
        await using var app = await IdentityApiFactory.CreateAsync(TimeSpan.FromMilliseconds(100));
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        app.DatabaseInterceptor.PersistenceDelay = TimeSpan.FromSeconds(2);
        app.WorkerClient.Response = new(HttpStatusCode.OK, ContractTestSession.ValidFeasibilityResult);
        var timer = Stopwatch.StartNew();

        var response = await client.PostAsJsonAsync("/api/feasibility/save", ValidRequest());

        timer.Stop();
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.True(timer.Elapsed < TimeSpan.FromSeconds(1), $"Deadline response took {timer.Elapsed}.");
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(
            "Analysis service is temporarily unavailable.",
            body.RootElement.GetProperty("error").GetString());
        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        Assert.Empty(await database.Listings.AsNoTracking().ToListAsync());
        Assert.Empty(await database.FeasibilityReports.AsNoTracking().ToListAsync());
    }

    [Fact]
    public async Task Feasibility_save_persists_trusted_worker_result_in_the_claimed_organization()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        var actor = await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        var earlierOrganizationId = await AddEarlierMembershipAsync(app, actor.UserId);
        app.WorkerClient.Response = new(HttpStatusCode.OK, ContractTestSession.ValidFeasibilityResult);

        var response = await client.PostAsJsonAsync("/api/feasibility/save", ValidRequest());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var forwardedOrganizationId = app.WorkerClient.LastRequest!.RootElement
            .GetProperty("organization_id")
            .GetGuid();
        Assert.Equal(actor.OrganizationId, forwardedOrganizationId);
        Assert.NotEqual(earlierOrganizationId, forwardedOrganizationId);
        AssertTimingHeader(response);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var listingId = body.RootElement.GetProperty("listingId").GetInt64();
        var reportId = body.RootElement.GetProperty("reportId").GetInt64();
        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        var listing = await database.Listings.AsNoTracking().SingleAsync(row => row.Id == listingId);
        var report = await database.FeasibilityReports.AsNoTracking().SingleAsync(row => row.Id == reportId);
        Assert.Equal(actor.OrganizationId, listing.OrganizationId);
        Assert.Equal(actor.OrganizationId, report.OrganizationId);
        Assert.Equal(actor.UserId, report.UserId);
        Assert.Equal("manual", listing.Source);
        Assert.Equal("RES3", listing.ZoneCode);
        Assert.Equal(81, listing.FeasibilityScore);
        Assert.Equal(5, report.ActualUnits);
        Assert.Equal("definitive", report.DecisionStatus);
        Assert.Equal(13500.25m, report.BuildRatePerSqm);
        Assert.Equal(2362543.75m, report.CostBuild);
        Assert.Equal(7.24m, report.YieldAt85OccPct);
    }

    public static IEnumerable<object[]> InvalidRequestJson()
    {
        yield return
        [
            ContractTestSession.ValidFeasibilityRequest.Replace(
                "\"address\"",
                "\"Address\"",
                StringComparison.Ordinal),
        ];
        yield return
        [
            ContractTestSession.ValidFeasibilityRequest.Replace(
                "\"size_sqm\": 1024",
                "\"size_sqm\": \"1024\"",
                StringComparison.Ordinal),
        ];
    }

    public static IEnumerable<object[]> InvalidWorkerResultJson()
    {
        yield return
        [
            ContractTestSession.ValidFeasibilityResult.Replace(
                "\"cost_build\"",
                "\"Cost_Build\"",
                StringComparison.Ordinal),
        ];
        yield return
        [
            ContractTestSession.ValidFeasibilityResult.Replace(
                "\"cost_build\": 2362543.75",
                "\"cost_build\": \"2362543.75\"",
                StringComparison.Ordinal),
        ];
    }

    private static object ValidRequest() => new
    {
        address = "123 Test Street",
        municipality = "johannesburg",
        zone_code = "RES3",
        size_sqm = 1024,
        price = 980000,
        unit_type = "bachelor",
        target_units = 8,
        tariff_year = 2026,
    };

    private static StringContent JsonContent(string json) =>
        new(json, Encoding.UTF8, "application/json");

    private static async Task AddZoneRuleAsync(IdentityApiFactory app)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        database.ZoningSchemeRules.Add(new ZoningSchemeRule
        {
            Municipality = "johannesburg",
            ZoneCode = "RES3",
            CoveragePct = 60,
            Far = 1.2m,
            MaxStoreys = 3,
            MaxUnitsPerErf = 20,
            MaxUnitsPerHa = 80,
        });
        await database.SaveChangesAsync();
    }

    private static async Task<Guid> AddEarlierMembershipAsync(IdentityApiFactory app, Guid userId)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        var organization = new Organization
        {
            Id = Guid.NewGuid(),
            Name = "Earlier Organization",
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-30),
        };
        database.Organizations.Add(organization);
        database.Memberships.Add(new Membership
        {
            Id = Guid.NewGuid(),
            OrganizationId = organization.Id,
            UserId = userId,
            Role = OrganizationRole.Owner,
            Status = MembershipStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-30),
            ActivatedAt = DateTimeOffset.UtcNow.AddDays(-30),
        });
        await database.SaveChangesAsync();
        return organization.Id;
    }

    private static async Task SetClaimedMembershipStatusAsync(
        IdentityApiFactory app,
        ContractActor actor,
        MembershipStatus status)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        var membership = await database.Memberships.SingleAsync(candidate =>
            candidate.UserId == actor.UserId &&
            candidate.OrganizationId == actor.OrganizationId);
        membership.Status = status;
        await database.SaveChangesAsync();
    }

    private static void AssertTimingHeader(HttpResponseMessage response)
    {
        Assert.True(response.Headers.TryGetValues("Server-Timing", out var values));
        var header = string.Join(",", values);
        Assert.Contains("worker;dur=", header, StringComparison.Ordinal);
        Assert.Contains("api;dur=", header, StringComparison.Ordinal);
    }
}
