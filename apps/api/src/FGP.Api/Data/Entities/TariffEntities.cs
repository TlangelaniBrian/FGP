using System.Text.Json;

namespace FGP.Api.Data.Entities;

public sealed class Tariff
{
    public int Id { get; set; }
    public Guid OrganizationId { get; set; }
    public int TariffYear { get; set; }
    public required string Category { get; set; }
    public required JsonDocument Data { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
