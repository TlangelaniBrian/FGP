using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace FGP.Api.Worker;

public interface IWorkerClient
{
    Task<WorkerResponse> PostAsync<TRequest>(string path, TRequest request, CancellationToken cancellationToken);
}

public sealed record WorkerResponse(HttpStatusCode StatusCode, string Body);

public sealed class HttpWorkerClient(HttpClient client) : IWorkerClient
{
    public async Task<WorkerResponse> PostAsync<TRequest>(string path, TRequest request, CancellationToken cancellationToken)
    {
        using var response = await client.PostAsJsonAsync(path, request, cancellationToken);
        return new WorkerResponse(response.StatusCode, await response.Content.ReadAsStringAsync(cancellationToken));
    }
}
