using FGP.Api.Spatial;
using Microsoft.Extensions.Options;
using System.Net;
using Xunit;

namespace FGP.Api.Tests;

public sealed class HttpWorkerClientTests
{
    [Fact]
    public async Task Worker_gateway_rejects_non_allowlisted_paths_without_sending_a_request()
    {
        var handler = new RecordingHandler((_, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)));
        using var httpClient = CreateClient(handler);
        var worker = CreateWorker(httpClient);

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
            worker.PostAsync("/scrape/property24", new { }, CancellationToken.None));

        Assert.Equal(0, handler.CallCount);
    }

    [Fact]
    public async Task Worker_gateway_propagates_caller_cancellation()
    {
        var handler = new RecordingHandler(async (_, cancellationToken) =>
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.OK);
        });
        using var httpClient = CreateClient(handler);
        var worker = CreateWorker(httpClient);
        using var cancellation = new CancellationTokenSource(TimeSpan.FromMilliseconds(50));

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            worker.PostAsync("/analyze/parcel", new { lat = -25.9, lng = 28.1 }, cancellation.Token));

        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task Worker_gateway_attaches_the_configured_service_bearer_credential()
    {
        var handler = new RecordingHandler((request, _) =>
        {
            Assert.Equal("Bearer", request.Headers.Authorization?.Scheme);
            Assert.Equal("test-worker-service-token", request.Headers.Authorization?.Parameter);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
        });
        using var httpClient = CreateClient(handler);
        var worker = CreateWorker(httpClient);

        var response = await worker.PostAsync(
            "/analyze/parcel",
            new { lat = -25.9, lng = 28.1 },
            CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, handler.CallCount);
    }

    private static HttpWorkerClient CreateWorker(HttpClient client) =>
        new(
            client,
            Options.Create(new WorkerOptions
            {
                ServiceToken = "test-worker-service-token",
            }));

    private static HttpClient CreateClient(HttpMessageHandler handler) =>
        new(handler)
        {
            BaseAddress = new Uri("http://worker.test"),
            Timeout = Timeout.InfiniteTimeSpan,
        };

    private sealed class RecordingHandler(
        Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> sendAsync) : HttpMessageHandler
    {
        public int CallCount { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            CallCount++;
            return sendAsync(request, cancellationToken);
        }
    }
}
