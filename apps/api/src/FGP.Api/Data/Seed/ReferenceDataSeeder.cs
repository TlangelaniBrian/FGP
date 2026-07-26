using System.Text.Json;
using FGP.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace FGP.Api.Data.Seed;

public static class ReferenceDataSeeder
{
    private static readonly DateTimeOffset SeedTimestamp = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    private static readonly RuleSeed[] Rules =
    [
        new("johannesburg", "RES1", 1, null, 40, .5m, 2, ["single_dwelling"], ["RES2", "RES3"], "medium", 2018),
        new("johannesburg", "RES2", 2, null, 50, .75m, 2, ["dwelling_units", "second_dwelling"], ["RES3", "RES4"], "medium", 2018),
        new("johannesburg", "RES3", null, 80, 60, 1.5m, 3, ["flats", "dwelling_units"], ["RES4"], "low", 2018),
        new("johannesburg", "RES4", null, 120, 70, 2.5m, 4, ["flats", "dwelling_units"], [], "low", 2018),
        new("johannesburg", "COM1", null, 150, 80, 3m, 6, ["retail", "offices", "mixed_use"], ["RES4"], "medium", 2018),
        new("tshwane", "RES1", 1, null, 40, .4m, 2, ["single_dwelling"], ["RES2", "RES3"], "medium", 2016),
        new("tshwane", "RES2", 2, null, 50, .6m, 2, ["dwelling_units"], ["RES3", "RES4"], "medium", 2016),
        new("tshwane", "RES3", null, 60, 55, 1.2m, 3, ["flats", "dwelling_units"], ["RES4"], "low", 2016),
        new("tshwane", "RES4", null, 100, 65, 2m, 4, ["flats", "dwelling_units"], [], "low", 2016),
        new("tshwane", "COM1", null, 140, 75, 2.5m, 5, ["retail", "offices", "mixed_use"], ["RES4"], "medium", 2016),
        new("ekurhuleni", "RES1", 1, null, 60, .6m, 2, ["single_dwelling"], ["RES2", "RES3"], "medium", 2014),
        new("ekurhuleni", "RES2", 3, null, 60, .8m, 2, ["dwelling_units", "second_dwelling"], ["RES3", "RES4"], "medium", 2014),
        new("ekurhuleni", "RES3", null, 70, 60, 1.4m, 3, ["flats", "dwelling_units"], ["RES4"], "low", 2014),
        new("ekurhuleni", "RES4", null, 110, 70, 2.2m, 4, ["flats", "dwelling_units"], [], "low", 2014),
        new("ekurhuleni", "COM1", null, 130, 80, 2.8m, 5, ["retail", "offices", "mixed_use"], ["RES4"], "medium", 2014),
    ];

    public static async Task SeedAsync(FgpDbContext database, Guid organizationId, CancellationToken cancellationToken = default)
    {
        foreach (var seed in Rules)
        {
            var row = await database.ZoningSchemeRules.SingleOrDefaultAsync(item => item.Municipality == seed.Municipality && item.ZoneCode == seed.ZoneCode, cancellationToken);
            if (row is null)
            {
                row = new ZoningSchemeRule { Municipality = seed.Municipality, ZoneCode = seed.ZoneCode };
                database.ZoningSchemeRules.Add(row);
            }
            row.ZoneLabel = seed.ZoneCode.StartsWith("RES", StringComparison.Ordinal) ? $"Residential {seed.ZoneCode[3..]}" : "Business 1";
            row.MaxUnitsPerErf = seed.MaxUnitsPerErf;
            row.MaxUnitsPerHa = seed.MaxUnitsPerHa;
            row.CoveragePct = seed.CoveragePct;
            row.Far = seed.Far;
            row.MaxStoreys = seed.MaxStoreys;
            row.PermittedUses = seed.PermittedUses;
            row.RezoningPossibleTo = seed.RezoningPossibleTo;
            row.RezoningDifficulty = seed.RezoningDifficulty;
            row.FormsRequired = ["zoning_certificate", "building_plan_checklist"];
            row.SchemeYear = seed.SchemeYear;
        }

        var tariffRows = new Dictionary<string, object>
        {
            ["build_rates"] = new Dictionary<string, int> { ["bachelor"] = 13500, ["1bed"] = 14200, ["2bed"] = 15000, ["luxury"] = 18500 },
            ["unit_sizes"] = new Dictionary<string, int> { ["bachelor"] = 35, ["1bed"] = 55, ["2bed"] = 85, ["luxury"] = 120 },
            ["market_rents"] = new Dictionary<string, int> { ["bachelor"] = 4500, ["1bed"] = 6500, ["2bed"] = 9500, ["luxury"] = 18000 },
            ["fees"] = new { professional_fee_pct = .12m },
            ["bulk_contributions"] = new { johannesburg = new { bachelor = new[] { 45000, 65000 } }, tshwane = new { bachelor = new[] { 38000, 55000 } }, ekurhuleni = new { bachelor = new[] { 40000, 58000 } } },
            ["transfer_duty_brackets"] = new object[] { new object[] { 1100000, 0m, 0 }, new object[] { 1512500, .03m, 0 }, new object[] { 2117500, .06m, 12375 }, new object[] { 2722500, .08m, 49125 }, new object[] { 12100000, .11m, 97125 }, new object?[] { null, .13m, 1128600 } },
        };
        foreach (var pair in tariffRows)
        {
            var row = await database.Tariffs.SingleOrDefaultAsync(item => item.OrganizationId == organizationId && item.TariffYear == 2026 && item.Category == pair.Key, cancellationToken);
            var data = JsonDocument.Parse(JsonSerializer.Serialize(pair.Value));
            if (row is null) database.Tariffs.Add(new Tariff { OrganizationId = organizationId, TariffYear = 2026, Category = pair.Key, Data = data, UpdatedAt = SeedTimestamp });
            else { row.Data = data; row.UpdatedAt = SeedTimestamp; }
        }
        await database.SaveChangesAsync(cancellationToken);
    }

    private sealed record RuleSeed(string Municipality, string ZoneCode, int? MaxUnitsPerErf, int? MaxUnitsPerHa, decimal CoveragePct, decimal Far, int MaxStoreys, string[] PermittedUses, string[] RezoningPossibleTo, string RezoningDifficulty, int SchemeYear);
}
