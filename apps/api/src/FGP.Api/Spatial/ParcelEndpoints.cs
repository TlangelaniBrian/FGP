using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace FGP.Api.Spatial;

public static class ParcelEndpoints
{
    private static readonly JsonSerializerOptions RequestJson = new()
    {
        PropertyNameCaseInsensitive = false,
        NumberHandling = JsonNumberHandling.Strict,
    };

    public static void MapParcelEndpoints(this WebApplication app)
    {
        app.MapPost("/api/parcel", AnalyzeParcelAsync).RequireAuthorization();
    }

    private static async Task<IResult> AnalyzeParcelAsync(
        JsonElement body,
        HttpContext httpContext,
        IWorkerClient worker,
        IOptions<AnalysisEndpointOptions> endpointOptions,
        CancellationToken requestCancellation)
    {
        var apiTimer = Stopwatch.StartNew();
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(requestCancellation);
        deadline.CancelAfter(TimeSpan.FromMilliseconds(endpointOptions.Value.EndpointTimeoutMilliseconds));
        ParcelRequest? request;
        try
        {
            request = body.Deserialize<ParcelRequest>(RequestJson);
        }
        catch (JsonException)
        {
            return WorkerEndpointResponses.InvalidBody();
        }

        if (request is null)
        {
            return WorkerEndpointResponses.InvalidBody();
        }

        var errors = new Dictionary<string, string[]>();
        if (request.Lat is < -27 or > -25)
        {
            errors["lat"] = ["Latitude must be between -27 and -25."];
        }
        if (request.Lng is < 27 or > 29.5)
        {
            errors["lng"] = ["Longitude must be between 27 and 29.5."];
        }
        if (errors.Count > 0)
        {
            return WorkerEndpointResponses.Invalid(errors);
        }

        try
        {
            deadline.Token.ThrowIfCancellationRequested();
            var workerCall = await WorkerEndpointResponses.CallAsync(
                worker,
                "/analyze/parcel",
                request,
                deadline.Token);
            deadline.Token.ThrowIfCancellationRequested();
            WorkerEndpointResponses.RecordTiming(httpContext, workerCall.Elapsed, apiTimer.Elapsed);
            return WorkerEndpointResponses.Forward(workerCall.Response);
        }
        catch (OperationCanceledException)
            when (deadline.IsCancellationRequested && !requestCancellation.IsCancellationRequested)
        {
            WorkerEndpointResponses.RecordTiming(httpContext, TimeSpan.Zero, apiTimer.Elapsed);
            return WorkerEndpointResponses.UnavailableResult();
        }
    }
}

public sealed record ParcelRequest(
    [property: JsonPropertyName("lat")] double Lat,
    [property: JsonPropertyName("lng")] double Lng);
