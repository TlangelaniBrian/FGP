using FGP.Api.Data;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;
using System.Text;

namespace FGP.Api.Tests;

internal sealed record ContractActor(Guid UserId, Guid OrganizationId);

internal static class ContractTestSession
{
    public const string ValidFeasibilityRequest = """
        {
          "address": "123 Test Street",
          "municipality": "johannesburg",
          "zone_code": "RES3",
          "size_sqm": 1024,
          "price": 980000,
          "unit_type": "bachelor",
          "target_units": 8,
          "tariff_year": 2026
        }
        """;

    public const string ValidFeasibilityResult = """
        {
          "viable": false,
          "decision_status": "definitive",
          "zoning_evidence_available": true,
          "tariff_year": 2026,
          "build_rate_per_sqm": 13500.25,
          "score": 81,
          "actual_units": 5,
          "max_units_allowed": 5,
          "rezoning_required": true,
          "capacity": {
            "density_units": 5,
            "far_units": 19,
            "footprint_storey_units": 23
          },
          "max_footprint_sqm": 614.4,
          "max_buildable_sqm": 1228.8,
          "cost_land": 980000.0,
          "cost_build": 2362543.75,
          "cost_professional_fees": 283505.25,
          "cost_bulk_contributions": 250000.0,
          "cost_transfer_duty": 0.0,
          "cost_total": 3876049.0,
          "rent_per_unit_monthly": 5500.75,
          "gross_monthly_income": 27503.75,
          "gross_annual_income": 330045.0,
          "yield_gross_pct": 8.51,
          "yield_at_85_occ_pct": 7.24,
          "viability_notes": "Yield is below the investment threshold.",
          "dolomite_risk": "UNKNOWN",
          "score_schools": 90,
          "score_transport": 75,
          "score_amenities": 80
        }
        """;

    public static async Task<ContractActor> RegisterConfirmAndSignInAsync(
        HttpClient client,
        IdentityApiFactory app,
        string email = "owner@example.test")
    {
        var register = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "CorrectHorseBatteryStaple1!",
            displayName = "Owner Example",
            organizationName = "Example Club",
        });
        if (register.StatusCode != HttpStatusCode.Created)
        {
            throw new InvalidOperationException($"Registration failed with HTTP {(int)register.StatusCode}.");
        }

        var confirmationUri = new Uri(app.EmailSender.Emails.Single().Link);
        var query = QueryHelpers.ParseQuery(confirmationUri.Query);
        var token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(query["token"].Single()!));
        var verify = await client.PostAsJsonAsync("/api/auth/verify-email", new
        {
            userId = query["userId"].Single(),
            token,
        });
        if (verify.StatusCode != HttpStatusCode.NoContent)
        {
            throw new InvalidOperationException($"Email verification failed with HTTP {(int)verify.StatusCode}.");
        }

        var signIn = await client.PostAsJsonAsync("/api/auth/sign-in", new
        {
            email,
            password = "CorrectHorseBatteryStaple1!",
        });
        if (signIn.StatusCode != HttpStatusCode.NoContent)
        {
            throw new InvalidOperationException($"Sign-in failed with HTTP {(int)signIn.StatusCode}.");
        }

        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
        return await database.Memberships
            .Where(membership => membership.UserId == Guid.Parse(query["userId"].Single()!))
            .Select(membership => new ContractActor(membership.UserId, membership.OrganizationId))
            .SingleAsync();
    }
}
