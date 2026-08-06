using System.Diagnostics;
using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace FGP.Api.Spatial;

public interface IWorkerClient
{
    Task<WorkerResponse> PostAsync<TRequest>(string path, TRequest request, CancellationToken cancellationToken);
}

public sealed record WorkerResponse(HttpStatusCode StatusCode, string Body, byte[]? Content = null);

public sealed class AnalysisEndpointOptions
{
    public int EndpointTimeoutMilliseconds { get; init; } = 8_000;
}

public sealed class WorkerOptions
{
    public string ServiceToken { get; init; } = string.Empty;
}

public sealed class HttpWorkerClient : IWorkerClient
{
    private static readonly HashSet<string> AllowedPaths =
    [
        "/analyze/parcel",
        "/analyze/feasibility",
        "/forms/generate",
    ];
    private const string UnavailableBody = """{"detail":"Analysis service is temporarily unavailable."}""";
    private readonly HttpClient _client;
    private readonly string _serviceToken;
    private readonly TimeSpan _workerTimeout;

    public HttpWorkerClient(HttpClient client, IOptions<WorkerOptions> options, IOptions<AnalysisEndpointOptions> endpointOptions)
    {
        _client = client;
        _serviceToken = options.Value.ServiceToken;
        _workerTimeout = TimeSpan.FromMilliseconds(endpointOptions.Value.EndpointTimeoutMilliseconds);
    }

    public async Task<WorkerResponse> PostAsync<TRequest>(
        string path,
        TRequest request,
        CancellationToken cancellationToken)
    {
        if (!AllowedPaths.Contains(path))
        {
            throw new ArgumentOutOfRangeException(nameof(path), path, "The worker path is not part of the private analysis contract.");
        }

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(_workerTimeout);
        try
        {
            using var message = new HttpRequestMessage(HttpMethod.Post, path)
            {
                Content = JsonContent.Create(request),
            };
            message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _serviceToken);
            using var response = await _client.SendAsync(message, timeout.Token);
            var content = await response.Content.ReadAsByteArrayAsync(timeout.Token);
            return new WorkerResponse(
                response.StatusCode,
                Encoding.UTF8.GetString(content),
                content);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return new WorkerResponse(HttpStatusCode.ServiceUnavailable, UnavailableBody);
        }
        catch (HttpRequestException)
        {
            return new WorkerResponse(HttpStatusCode.ServiceUnavailable, UnavailableBody);
        }
    }
}

internal static class WorkerEndpointResponses
{
    private const string UnavailableMessage = "Analysis service is temporarily unavailable.";

    public static async Task<(WorkerResponse Response, TimeSpan Elapsed)> CallAsync<TRequest>(
        IWorkerClient worker,
        string path,
        TRequest request,
        CancellationToken cancellationToken)
    {
        var timer = Stopwatch.StartNew();
        try
        {
            return (await worker.PostAsync(path, request, cancellationToken), timer.Elapsed);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return (Unavailable(), timer.Elapsed);
        }
        catch (HttpRequestException)
        {
            return (Unavailable(), timer.Elapsed);
        }
    }

    public static void RecordTiming(HttpContext context, TimeSpan workerElapsed, TimeSpan apiElapsed)
    {
        context.Response.Headers["Server-Timing"] = string.Create(
            CultureInfo.InvariantCulture,
            $"worker;dur={workerElapsed.TotalMilliseconds:F2}, api;dur={apiElapsed.TotalMilliseconds:F2}");
    }

    public static IResult Forward(WorkerResponse response)
    {
        if (response.StatusCode == HttpStatusCode.OK)
        {
            return Results.Content(response.Body, "application/json", statusCode: StatusCodes.Status200OK);
        }

        if (response.StatusCode is > HttpStatusCode.OK and < HttpStatusCode.MultipleChoices)
        {
            return Results.Json(
                new WorkerRouteError("Worker returned an unexpected status."),
                statusCode: StatusCodes.Status502BadGateway);
        }

        return Results.Json(
            new WorkerRouteError(ExtractError(response.Body)),
            statusCode: (int)response.StatusCode);
    }

    public static IResult Invalid(IDictionary<string, string[]> fieldErrors) =>
        Results.Json(
            new LegacyValidationError(new LegacyValidationDetails([], fieldErrors)),
            statusCode: StatusCodes.Status422UnprocessableEntity);

    public static IResult InvalidBody() =>
        Results.Json(
            new LegacyValidationError(new LegacyValidationDetails(
                ["The request body is invalid."],
                new Dictionary<string, string[]>())),
            statusCode: StatusCodes.Status422UnprocessableEntity);

    public static IResult InvalidWorkerResult() =>
        Results.Json(
            new WorkerRouteError("Worker returned an invalid feasibility result"),
            statusCode: StatusCodes.Status502BadGateway);

    public static IResult UnavailableResult() =>
        Results.Json(
            new WorkerRouteError(UnavailableMessage),
            statusCode: StatusCodes.Status503ServiceUnavailable);

    public static IResult ZoningRulesUnavailable() =>
        Results.Json(
            new WorkerRouteError("Zoning rules could not be loaded"),
            statusCode: StatusCodes.Status503ServiceUnavailable);

    private static WorkerResponse Unavailable() =>
        new(HttpStatusCode.ServiceUnavailable, JsonSerializer.Serialize(new { detail = UnavailableMessage }));

    private static object ExtractError(string body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            if (document.RootElement.TryGetProperty("detail", out var detail))
            {
                return detail.ValueKind == JsonValueKind.String
                    ? detail.GetString() ?? string.Empty
                    : detail.Clone();
            }
        }
        catch (JsonException)
        {
        }

        return string.IsNullOrWhiteSpace(body) ? "Worker request failed" : body;
    }
}

internal sealed record WorkerRouteError(
    [property: JsonPropertyName("error")] object Error);

internal sealed record LegacyValidationError(
    [property: JsonPropertyName("error")] LegacyValidationDetails Error);

internal sealed record LegacyValidationDetails(
    [property: JsonPropertyName("formErrors")] string[] FormErrors,
    [property: JsonPropertyName("fieldErrors")] IDictionary<string, string[]> FieldErrors);
