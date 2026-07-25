using FGP.Api.Data;
using FGP.Api.Data.Entities;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using Xunit;

namespace FGP.Api.Tests;

public sealed class AnalysisEndpointTests
{
    [Fact]
    public async Task Parcel_analysis_requires_an_authenticated_organization_member()
    {
        await using var app = await IdentityApiFactory.CreateAsync();

        var response = await app.CreateClient().PostAsJsonAsync("/api/parcel", new { lat = -25.9, lng = 28.1 });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Parcel_analysis_preserves_the_worker_contract_for_an_authenticated_member()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await RegisterConfirmAndSignInAsync(client, app);
        app.WorkerClient.Response = new(HttpStatusCode.OK, "{\"found\":true,\"dolomite_risk\":\"LOW\",\"amenities\":[]}");

        var response = await client.PostAsJsonAsync("/api/parcel", new { lat = -25.9, lng = 28.1 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("/analyze/parcel", app.WorkerClient.LastPath);
        Assert.True((await response.Content.ReadAsStringAsync()).Contains("dolomite_risk", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Feasibility_analysis_supplies_matching_portable_zone_rules_to_the_worker()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        await using (var scope = app.Services.CreateAsyncScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
            database.ZoningSchemeRules.Add(new ZoningSchemeRule
            {
                Municipality = "johannesburg",
                ZoneCode = "RES3",
                CoveragePct = 60,
                Far = 1.2m,
                MaxStoreys = 3,
                MaxUnitsPerErf = 20,
            });
            await database.SaveChangesAsync();
        }
        var client = app.CreateClient();
        await RegisterConfirmAndSignInAsync(client, app);
        app.WorkerClient.Response = new(HttpStatusCode.OK, "{\"viable\":true,\"score\":81}");

        var response = await client.PostAsJsonAsync("/api/feasibility", new
        {
            address = "123 Test Street",
            municipality = "johannesburg",
            zone_code = "res3",
            size_sqm = 1024,
            price = 980000,
            unit_type = "bachelor",
            target_units = 8,
            tariff_year = 2026,
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("/analyze/feasibility", app.WorkerClient.LastPath);
        Assert.Equal(60, app.WorkerClient.LastRequest!.RootElement.GetProperty("zone_rules").GetProperty("coverage_pct").GetDecimal());
    }

    private static async Task RegisterConfirmAndSignInAsync(HttpClient client, IdentityApiFactory app)
    {
        await client.PostAsJsonAsync("/api/auth/register", new
        {
            email = "owner@example.test",
            password = "CorrectHorseBatteryStaple1!",
            displayName = "Owner Example",
            organizationName = "Example Club",
        });
        var confirmationUri = new Uri(app.EmailSender.Emails.Single().Link);
        var query = QueryHelpers.ParseQuery(confirmationUri.Query);
        var token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(query["token"].Single()!));
        await client.PostAsJsonAsync("/api/auth/verify-email", new { userId = query["userId"].Single(), token });
        await client.PostAsJsonAsync("/api/auth/sign-in", new { email = "owner@example.test", password = "CorrectHorseBatteryStaple1!" });
    }
}
