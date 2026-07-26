using FGP.Api.Data;
using FGP.Api.Data.Entities;
using FGP.Api.Identity;
using FGP.Api.Organizations;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;
using System.Globalization;
using System.Security.Claims;
using System.Text.Json;

namespace FGP.Api.Tariffs;

public static class TariffEndpoints
{
    private const int DefaultYear = 2026;

    public static void MapTariffEndpoints(this WebApplication app)
    {
        var tariffs = app.MapGroup("/api/tariffs").RequireAuthorization();
        tariffs.MapGet("/", GetTariffsAsync);
        tariffs.MapPut("/", PutTariffAsync).RequireAuthorization(Capabilities.EditTariffs);
    }

    private static async Task<IResult> GetTariffsAsync(
        HttpContext httpContext,
        FgpDbContext database,
        CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(httpContext, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();

        var yearValue = httpContext.Request.Query["year"].FirstOrDefault();
        var year = yearValue is null
            ? DefaultYear
            : int.TryParse(yearValue, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsedYear)
                ? parsedYear
                : 0;
        if (year is < 2024 or > 2030)
        {
            return ValidationError("year must be between 2024 and 2030");
        }

        var rows = await database.Tariffs
            .AsNoTracking()
            .Where(tariff =>
                tariff.OrganizationId == actor.OrganizationId &&
                tariff.TariffYear == year)
            .ToListAsync(cancellationToken);
        var grouped = rows.ToDictionary(
            tariff => tariff.Category,
            tariff => tariff.Data.RootElement.Clone(),
            StringComparer.Ordinal);

        return Results.Ok(new TariffReadResponse(year, grouped));
    }

    private static async Task<IResult> PutTariffAsync(
        HttpContext httpContext,
        FgpDbContext database,
        CancellationToken cancellationToken)
    {
        var parsed = await ParseWriteRequestAsync(httpContext.Request, cancellationToken);
        if (parsed.Error is not null)
        {
            return parsed.Error;
        }

        var actor = await ResolveActorAsync(httpContext, database, cancellationToken);
        if (actor is null) return Results.Unauthorized();

        var request = parsed.Request!;
        var now = DateTimeOffset.UtcNow;
        var response = await UpsertTariffAsync(
            database,
            actor.OrganizationId,
            request,
            now,
            cancellationToken);

        return Results.Ok(response);
    }

    private static async Task<TariffResponse> UpsertTariffAsync(
        FgpDbContext database,
        Guid organizationId,
        TariffWriteRequest request,
        DateTimeOffset updatedAt,
        CancellationToken cancellationToken)
    {
        var data = request.Data.GetRawText();
        await database.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            var connection = (NpgsqlConnection)database.Database.GetDbConnection();
            await using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO tariffs (
                    organization_id,
                    tariff_year,
                    category,
                    data,
                    updated_at
                )
                VALUES (
                    @organization_id,
                    @tariff_year,
                    @category,
                    @data,
                    @updated_at
                )
                ON CONFLICT (organization_id, tariff_year, category)
                DO UPDATE SET
                    data = EXCLUDED.data,
                    updated_at = EXCLUDED.updated_at
                RETURNING id
                """;
            command.Parameters.AddWithValue("organization_id", organizationId);
            command.Parameters.AddWithValue("tariff_year", request.Year);
            command.Parameters.AddWithValue("category", request.Category);
            command.Parameters.AddWithValue("data", NpgsqlDbType.Jsonb, data);
            command.Parameters.AddWithValue("updated_at", updatedAt);
            var id = (int)(await command.ExecuteScalarAsync(cancellationToken)
                ?? throw new InvalidOperationException("Tariff upsert did not return an identifier."));

            using var document = JsonDocument.Parse(data);
            return new TariffResponse(id, request.Year, request.Category, document.RootElement.Clone(), updatedAt);
        }
        finally
        {
            await database.Database.CloseConnectionAsync();
        }
    }

    private static async Task<ParsedTariffWrite> ParseWriteRequestAsync(
        HttpRequest request,
        CancellationToken cancellationToken)
    {
        JsonDocument document;
        try
        {
            document = await JsonDocument.ParseAsync(request.Body, cancellationToken: cancellationToken);
        }
        catch (JsonException)
        {
            return new(null, ValidationError("request body must contain valid JSON"));
        }

        using (document)
        {
            var root = document.RootElement;
            if (!HasExactProperties(root, ["year", "category", "data"], ["category", "data"]))
            {
                return new(null, ValidationError("request must contain only year, category, and data"));
            }

            var year = DefaultYear;
            if (root.TryGetProperty("year", out var yearElement) &&
                (yearElement.ValueKind != JsonValueKind.Number || !yearElement.TryGetInt32(out year)))
            {
                return new(null, ValidationError("year must be an integer"));
            }
            if (year is < 2024 or > 2030)
            {
                return new(null, ValidationError("year must be between 2024 and 2030"));
            }

            var categoryElement = root.GetProperty("category");
            if (categoryElement.ValueKind != JsonValueKind.String)
            {
                return new(null, ValidationError("category must be a supported string"));
            }
            var category = categoryElement.GetString()!;
            var data = root.GetProperty("data");
            var dataIsValid = category switch
            {
                "build_rates" or "unit_sizes" or "market_rents" => IsUnitValues(data),
                "bulk_contributions" => IsBulkContributions(data),
                "transfer_duty_brackets" => IsDutyBrackets(data),
                "fees" => IsFees(data),
                _ => false,
            };
            if (!dataIsValid)
            {
                return new(null, ValidationError("data does not match the selected tariff category"));
            }

            return new(new TariffWriteRequest(year, category, data.Clone()), null);
        }
    }

    private static bool IsUnitValues(JsonElement data)
    {
        string[] units = ["bachelor", "1bed", "2bed", "luxury"];
        return HasExactProperties(data, units, units) &&
               units.All(unit => IsPositiveNumber(data.GetProperty(unit)));
    }

    private static bool IsBulkContributions(JsonElement data)
    {
        string[] municipalities = ["johannesburg", "tshwane", "ekurhuleni"];
        string[] units = ["bachelor", "1bed", "2bed", "luxury"];
        if (!HasExactProperties(data, municipalities, municipalities))
        {
            return false;
        }

        foreach (var municipality in municipalities)
        {
            var ranges = data.GetProperty(municipality);
            if (!HasExactProperties(ranges, units, units))
            {
                return false;
            }
            foreach (var unit in units)
            {
                var range = ranges.GetProperty(unit);
                if (range.ValueKind != JsonValueKind.Array ||
                    range.GetArrayLength() != 2 ||
                    !TryGetPositiveDecimal(range[0], out var minimum) ||
                    !TryGetPositiveDecimal(range[1], out var maximum) ||
                    minimum > maximum)
                {
                    return false;
                }
            }
        }

        return true;
    }

    private static bool IsDutyBrackets(JsonElement data)
    {
        if (data.ValueKind != JsonValueKind.Array || data.GetArrayLength() < 2)
        {
            return false;
        }

        decimal previousUpper = decimal.MinValue;
        decimal previousBase = decimal.MinValue;
        for (var index = 0; index < data.GetArrayLength(); index++)
        {
            var bracket = data[index];
            if (bracket.ValueKind != JsonValueKind.Array || bracket.GetArrayLength() != 3)
            {
                return false;
            }

            var upperElement = bracket[0];
            var isFinal = index == data.GetArrayLength() - 1;
            if (upperElement.ValueKind == JsonValueKind.Null)
            {
                if (!isFinal)
                {
                    return false;
                }
            }
            else if (!TryGetPositiveDecimal(upperElement, out var upper) || upper <= previousUpper)
            {
                return false;
            }
            else
            {
                previousUpper = upper;
            }

            if (!TryGetDecimal(bracket[1], out var rate) || rate is < 0 or > 1 ||
                !TryGetDecimal(bracket[2], out var cumulativeBase) ||
                cumulativeBase < 0 ||
                cumulativeBase < previousBase)
            {
                return false;
            }
            previousBase = cumulativeBase;
        }

        return data[data.GetArrayLength() - 1][0].ValueKind == JsonValueKind.Null;
    }

    private static bool IsFees(JsonElement data)
    {
        string[] properties = ["professional_fee_pct"];
        return HasExactProperties(data, properties, properties) &&
               TryGetDecimal(data.GetProperty("professional_fee_pct"), out var fee) &&
               fee is > 0 and <= 0.3m;
    }

    private static bool HasExactProperties(
        JsonElement element,
        IReadOnlyCollection<string> allowed,
        IReadOnlyCollection<string> required)
    {
        if (element.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        var names = element.EnumerateObject().Select(property => property.Name).ToArray();
        return names.Length == names.Distinct(StringComparer.Ordinal).Count() &&
               names.All(allowed.Contains) &&
               required.All(name => names.Contains(name, StringComparer.Ordinal));
    }

    private static bool IsPositiveNumber(JsonElement element) =>
        TryGetPositiveDecimal(element, out _);

    private static bool TryGetPositiveDecimal(JsonElement element, out decimal value)
    {
        if (TryGetDecimal(element, out value) && value > 0)
        {
            return true;
        }

        value = default;
        return false;
    }

    private static bool TryGetDecimal(JsonElement element, out decimal value)
    {
        if (element.ValueKind == JsonValueKind.Number && element.TryGetDecimal(out value))
        {
            return true;
        }

        value = default;
        return false;
    }

    private static async Task<TariffActor?> ResolveActorAsync(
        HttpContext httpContext,
        FgpDbContext database,
        CancellationToken cancellationToken)
    {
        var userClaim = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
        var organizationClaim = httpContext.User.FindFirstValue("organization_id");
        if (!Guid.TryParse(userClaim, out var userId) ||
            !Guid.TryParse(organizationClaim, out var organizationId))
        {
            return null;
        }

        var hasMembership = await database.Memberships
            .AsNoTracking()
            .AnyAsync(
                membership =>
                    membership.UserId == userId &&
                    membership.OrganizationId == organizationId &&
                    membership.Status == MembershipStatus.Active,
                cancellationToken);
        return hasMembership ? new TariffActor(organizationId) : null;
    }

    private static IResult ValidationError(string message) =>
        Results.Json(new { error = message }, statusCode: StatusCodes.Status422UnprocessableEntity);

}

public sealed record TariffReadResponse(int Year, IReadOnlyDictionary<string, JsonElement> Tariffs);
public sealed record TariffResponse(int Id, int TariffYear, string Category, JsonElement Data, DateTimeOffset UpdatedAt);
internal sealed record TariffWriteRequest(int Year, string Category, JsonElement Data);
internal sealed record ParsedTariffWrite(TariffWriteRequest? Request, IResult? Error);
internal sealed record TariffActor(Guid OrganizationId);
