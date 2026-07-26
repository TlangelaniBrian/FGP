using FGP.Api.Data;
using FGP.Api.Identity;
using FGP.Api.Organizations;
using FGP.Api.Spatial;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using Testcontainers.PostgreSql;
using System.Data.Common;
using System.Net;
using System.Text.Json;
using System.Threading;

namespace FGP.Api.Tests;

public sealed class IdentityApiFactory : WebApplicationFactory<global::Program>, IAsyncDisposable
{
    private const string TemplateDatabaseName = "fgp_test_template";
    private static readonly PostgreSqlContainer SharedDatabase = new PostgreSqlBuilder()
        .WithImage("postgis/postgis:15-3.4")
        .Build();
    private static readonly SemaphoreSlim SharedDatabaseLock = new(1, 1);
    private static bool _sharedDatabaseStarted;
    private static bool _templateDatabaseInitialized;
    private readonly TimeSpan? _analysisEndpointTimeout;
    private readonly string _databaseName = $"fgp_test_{Guid.NewGuid():N}";
    private string _connectionString = string.Empty;

    static IdentityApiFactory()
    {
        AppDomain.CurrentDomain.ProcessExit += (_, _) =>
        {
            if (_sharedDatabaseStarted)
            {
                SharedDatabase.DisposeAsync().AsTask().GetAwaiter().GetResult();
            }
        };
    }

    public TestIdentityEmailSender EmailSender { get; } = new();
    public TestWorkerClient WorkerClient { get; } = new();
    public TestDatabaseInterceptor DatabaseInterceptor { get; } = new();

    private IdentityApiFactory(TimeSpan? analysisEndpointTimeout)
    {
        _analysisEndpointTimeout = analysisEndpointTimeout;
    }

    public static async Task<IdentityApiFactory> CreateAsync(TimeSpan? analysisEndpointTimeout = null)
    {
        var factory = new IdentityApiFactory(analysisEndpointTimeout);
        await EnsureSharedDatabaseStartedAsync();
        await SharedDatabaseLock.WaitAsync();
        try
        {
            await factory.CreateDatabaseAsync();
        }
        finally
        {
            SharedDatabaseLock.Release();
        }
        return factory;
    }

    private static async Task EnsureSharedDatabaseStartedAsync()
    {
        await SharedDatabaseLock.WaitAsync();
        try
        {
            if (!_sharedDatabaseStarted)
            {
                await SharedDatabase.StartAsync();
                _sharedDatabaseStarted = true;
            }

            if (!_templateDatabaseInitialized)
            {
                await CreateDatabaseAsync(TemplateDatabaseName);
                await FgpMigrator.ApplyAsync(BuildConnectionString(TemplateDatabaseName, pooling: false));
                _templateDatabaseInitialized = true;
            }
        }
        finally
        {
            SharedDatabaseLock.Release();
        }
    }

    private async Task CreateDatabaseAsync()
    {
        await CreateDatabaseAsync(_databaseName, useTemplate: true);
        _connectionString = BuildConnectionString(_databaseName);
    }

    private static async Task CreateDatabaseAsync(string databaseName, bool useTemplate = false)
    {
        var adminConnectionString = SharedDatabase.GetConnectionString();
        await using var connection = new NpgsqlConnection(adminConnectionString);
        await connection.OpenAsync();
        var templateClause = useTemplate ? $" TEMPLATE \"{TemplateDatabaseName}\"" : string.Empty;
        await using var command = new NpgsqlCommand($"CREATE DATABASE \"{databaseName}\"{templateClause}", connection);
        await command.ExecuteNonQueryAsync();
    }

    private static string BuildConnectionString(string databaseName, bool pooling = true) =>
        new NpgsqlConnectionStringBuilder(SharedDatabase.GetConnectionString())
        {
            Database = databaseName,
            Pooling = pooling,
        }.ConnectionString;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:Fgp", _connectionString);
        builder.UseSetting("Worker:ServiceToken", "test-worker-service-token");
        if (_analysisEndpointTimeout is not null)
        {
            builder.UseSetting(
                "Analysis:EndpointTimeoutMilliseconds",
                _analysisEndpointTimeout.Value.TotalMilliseconds.ToString(System.Globalization.CultureInfo.InvariantCulture));
        }
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<FgpDbContext>>();
            services.RemoveAll<FgpDbContext>();
            services.AddDbContext<FgpDbContext>(options =>
                options
                    .UseNpgsql(
                        _connectionString,
                        npgsql => npgsql.UseNetTopologySuite())
                    .AddInterceptors(DatabaseInterceptor));
            services.RemoveAll<IEmailSender<ApplicationUser>>();
            services.AddSingleton<IEmailSender<ApplicationUser>>(EmailSender);
            services.RemoveAll<IOrganizationInvitationSender>();
            services.AddSingleton<IOrganizationInvitationSender>(EmailSender);
            services.RemoveAll<IWorkerClient>();
            services.AddSingleton<IWorkerClient>(WorkerClient);
        });
    }

    public new async ValueTask DisposeAsync()
    {
        Dispose();
        if (!string.IsNullOrWhiteSpace(_connectionString))
        {
            var adminConnectionString = SharedDatabase.GetConnectionString();
            await using var connection = new NpgsqlConnection(adminConnectionString);
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{_databaseName}\" WITH (FORCE)", connection);
            await command.ExecuteNonQueryAsync();
        }
    }
}

public sealed class TestDatabaseInterceptor : DbCommandInterceptor
{
    public Exception? ZoningLookupException { get; set; }
    public TimeSpan ZoningLookupDelay { get; set; }
    public TimeSpan PersistenceDelay { get; set; }
    private AsyncTestBarrier? _tariffReadBarrier;

    public void ArmTariffReadBarrier(int participants) =>
        _tariffReadBarrier = new AsyncTestBarrier(participants);

    public void DisarmTariffReadBarrier() =>
        _tariffReadBarrier = null;

    public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
        DbCommand command,
        CommandEventData eventData,
        InterceptionResult<DbDataReader> result,
        CancellationToken cancellationToken = default)
    {
        if (command.CommandText.Contains("zoning_scheme_rules", StringComparison.OrdinalIgnoreCase))
        {
            if (ZoningLookupException is not null)
            {
                throw ZoningLookupException;
            }
            if (ZoningLookupDelay > TimeSpan.Zero)
            {
                await Task.Delay(ZoningLookupDelay, cancellationToken);
            }
        }
        if (command.CommandText.Contains("INSERT INTO", StringComparison.OrdinalIgnoreCase) &&
            command.CommandText.Contains("listings", StringComparison.OrdinalIgnoreCase) &&
            PersistenceDelay > TimeSpan.Zero)
        {
            await Task.Delay(PersistenceDelay, cancellationToken);
        }
        if (_tariffReadBarrier is not null &&
            command.CommandText.Contains("SELECT", StringComparison.OrdinalIgnoreCase) &&
            command.CommandText.Contains("tariffs", StringComparison.OrdinalIgnoreCase))
        {
            await _tariffReadBarrier.SignalAndWaitAsync(cancellationToken);
        }

        return result;
    }

    private sealed class AsyncTestBarrier(int participants)
    {
        private readonly TaskCompletionSource _release =
            new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int _remaining = participants;

        public async Task SignalAndWaitAsync(CancellationToken cancellationToken)
        {
            if (Interlocked.Decrement(ref _remaining) == 0)
            {
                _release.TrySetResult();
            }

            await _release.Task.WaitAsync(TimeSpan.FromSeconds(10), cancellationToken);
        }
    }
}

public sealed class TestIdentityEmailSender : IEmailSender<ApplicationUser>, IOrganizationInvitationSender
{
    public List<IdentityEmail> Emails { get; } = [];

    public Task SendConfirmationLinkAsync(ApplicationUser user, string email, string confirmationLink)
    {
        Emails.Add(new IdentityEmail("confirmation", email, confirmationLink));
        return Task.CompletedTask;
    }

    public Task SendPasswordResetLinkAsync(ApplicationUser user, string email, string resetLink)
    {
        Emails.Add(new IdentityEmail("password-reset", email, resetLink));
        return Task.CompletedTask;
    }

    public Task SendPasswordResetCodeAsync(ApplicationUser user, string email, string resetCode)
    {
        Emails.Add(new IdentityEmail("password-reset-code", email, resetCode));
        return Task.CompletedTask;
    }

    public Task SendInvitationAsync(string email, string invitationLink)
    {
        Emails.Add(new IdentityEmail("invitation", email, invitationLink));
        return Task.CompletedTask;
    }
}

public sealed record IdentityEmail(string Kind, string Email, string Link);

public sealed class TestWorkerClient : IWorkerClient
{
    public string? LastPath { get; private set; }
    public JsonDocument? LastRequest { get; private set; }
    public int CallCount { get; private set; }
    public TimeSpan Delay { get; set; }
    public Exception? ExceptionToThrow { get; set; }
    public WorkerResponse Response { get; set; } = new(HttpStatusCode.OK, "{\"found\":false,\"amenities\":[]}");

    public async Task<WorkerResponse> PostAsync<TRequest>(string path, TRequest request, CancellationToken cancellationToken)
    {
        CallCount++;
        LastPath = path;
        LastRequest?.Dispose();
        LastRequest = JsonSerializer.SerializeToDocument(request);
        if (Delay > TimeSpan.Zero)
        {
            await Task.Delay(Delay, cancellationToken);
        }
        if (ExceptionToThrow is not null)
        {
            throw ExceptionToThrow;
        }
        return Response;
    }
}
