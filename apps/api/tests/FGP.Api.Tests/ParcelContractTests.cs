using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Xunit;

namespace FGP.Api.Tests;

public sealed class ParcelContractTests
{
    [Fact]
    public async Task Parcel_requires_authentication_without_calling_the_worker()
    {
        await using var app = await IdentityApiFactory.CreateAsync();

        var response = await app.CreateClient().PostAsJsonAsync("/api/parcel", new { lat = -25.9, lng = 28.1 });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(0, app.WorkerClient.CallCount);
    }

    [Fact]
    public async Task Parcel_preserves_worker_property_names_and_records_sub_ten_second_timings()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        app.WorkerClient.Delay = TimeSpan.FromMilliseconds(20);
        app.WorkerClient.Response = new(HttpStatusCode.OK, """
            {
              "found": true,
              "parcel_id": 1247,
              "erf_number": "ERF 1247",
              "township": "Noordwyk Ext 19",
              "municipality": "johannesburg",
              "size_sqm": 1024.5,
              "boundary_geojson": "{\"type\":\"Polygon\",\"coordinates\":[]}",
              "zone_code": "RES3",
              "zone_label": "Residential 3",
              "coverage_pct": 60.0,
              "far": 1.5,
              "max_storeys": 3,
              "rezoning_difficulty": "medium",
              "forms_required": ["zoning_certificate"],
              "dolomite_risk": "LOW",
              "cgs_reference": "CGS-GTG-2024-001",
              "max_footprint_sqm": 614.7,
              "max_buildable_sqm": 1536.75,
              "net_buildable_sqm": 1306.24,
              "max_units": 8,
              "score_schools": 92,
              "score_transport": 76,
              "score_amenities": 81,
              "score_composite": 84,
              "amenities": []
            }
            """);
        var timer = Stopwatch.StartNew();

        var response = await client.PostAsJsonAsync("/api/parcel", new { lat = -25.9, lng = 28.1 });

        timer.Stop();
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(timer.Elapsed < TimeSpan.FromSeconds(10), $"Parcel request took {timer.Elapsed}.");
        Assert.Equal("/analyze/parcel", app.WorkerClient.LastPath);
        Assert.Equal(-25.9, app.WorkerClient.LastRequest!.RootElement.GetProperty("lat").GetDouble());
        AssertTimingHeader(response);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var expectedNames = new HashSet<string>
        {
            "found", "parcel_id", "erf_number", "township", "municipality", "size_sqm",
            "boundary_geojson", "zone_code", "zone_label", "coverage_pct", "far",
            "max_storeys", "rezoning_difficulty", "forms_required", "dolomite_risk",
            "cgs_reference", "max_footprint_sqm", "max_buildable_sqm", "net_buildable_sqm",
            "max_units", "score_schools", "score_transport", "score_amenities",
            "score_composite", "amenities",
        };
        Assert.True(expectedNames.SetEquals(body.RootElement.EnumerateObject().Select(property => property.Name)));
        Assert.Equal(1024.5, body.RootElement.GetProperty("size_sqm").GetDouble());
        Assert.Equal("LOW", body.RootElement.GetProperty("dolomite_risk").GetString());
    }

    [Theory]
    [InlineData(-27.01, 28.1)]
    [InlineData(-24.99, 28.1)]
    [InlineData(-25.9, 26.99)]
    [InlineData(-25.9, 29.51)]
    public async Task Parcel_rejects_coordinates_outside_Gauteng(double lat, double lng)
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);

        var response = await client.PostAsJsonAsync("/api/parcel", new { lat, lng });

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal(0, app.WorkerClient.CallCount);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(body.RootElement.TryGetProperty("error", out _));
    }

    [Theory]
    [InlineData("""{"Lat":-25.9,"lng":28.1}""")]
    [InlineData("""{"lat":"-25.9","lng":28.1}""")]
    public async Task Parcel_rejects_case_variant_names_and_quoted_numbers(string json)
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);

        var response = await client.PostAsync(
            "/api/parcel",
            new StringContent(json, Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal(0, app.WorkerClient.CallCount);
    }

    [Fact]
    public async Task Parcel_preserves_worker_rate_limit_as_429_error()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        app.WorkerClient.Response = new(HttpStatusCode.TooManyRequests, """
            {"detail":"Rate limit exceeded: 10 requests/minute"}
            """);

        var response = await client.PostAsJsonAsync("/api/parcel", new { lat = -25.9, lng = 28.1 });

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("Rate limit exceeded: 10 requests/minute", body.RootElement.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Parcel_rejects_unexpected_async_worker_response_instead_of_returning_202()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        app.WorkerClient.Response = new(HttpStatusCode.Accepted, """{"job_id":123}""");

        var response = await client.PostAsJsonAsync("/api/parcel", new { lat = -25.9, lng = 28.1 });

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("Worker returned an unexpected status.", body.RootElement.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Parcel_endpoint_deadline_cancels_a_slow_worker()
    {
        await using var app = await IdentityApiFactory.CreateAsync(TimeSpan.FromMilliseconds(100));
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        app.WorkerClient.Delay = TimeSpan.FromSeconds(2);
        var timer = Stopwatch.StartNew();

        var response = await client.PostAsJsonAsync("/api/parcel", new { lat = -25.9, lng = 28.1 });

        timer.Stop();
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.True(timer.Elapsed < TimeSpan.FromSeconds(1), $"Deadline response took {timer.Elapsed}.");
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(
            "Analysis service is temporarily unavailable.",
            body.RootElement.GetProperty("error").GetString());
        Assert.Equal(1, app.WorkerClient.CallCount);
        AssertTimingHeader(response);
    }

    [Theory]
    [MemberData(nameof(UnavailableFailures))]
    public async Task Parcel_maps_worker_connection_and_timeout_failures_to_stable_503(Exception failure)
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        app.WorkerClient.ExceptionToThrow = failure;

        var response = await client.PostAsJsonAsync("/api/parcel", new { lat = -25.9, lng = 28.1 });

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("Analysis service is temporarily unavailable.", body.RootElement.GetProperty("error").GetString());
        Assert.DoesNotContain("secret", await response.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
        AssertTimingHeader(response);
    }

    public static IEnumerable<object[]> UnavailableFailures()
    {
        yield return [new HttpRequestException("secret connection details")];
        yield return [new TaskCanceledException("secret timeout details")];
    }

    private static void AssertTimingHeader(HttpResponseMessage response)
    {
        Assert.True(response.Headers.TryGetValues("Server-Timing", out var values));
        var header = string.Join(",", values);
        Assert.Contains("worker;dur=", header, StringComparison.Ordinal);
        Assert.Contains("api;dur=", header, StringComparison.Ordinal);
    }
}
