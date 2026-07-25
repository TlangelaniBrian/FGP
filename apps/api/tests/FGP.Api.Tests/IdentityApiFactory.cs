using FGP.Api.Data;
using FGP.Api.Identity;
using FGP.Api.Organizations;
using FGP.Api.Worker;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Testcontainers.PostgreSql;
using System.Net;
using System.Text.Json;

namespace FGP.Api.Tests;

public sealed class IdentityApiFactory : WebApplicationFactory<global::Program>, IAsyncDisposable
{
    private readonly PostgreSqlContainer _database = new PostgreSqlBuilder()
        .WithImage("postgis/postgis:15-3.4")
        .Build();

    public TestIdentityEmailSender EmailSender { get; } = new();
    public TestWorkerClient WorkerClient { get; } = new();

    public static async Task<IdentityApiFactory> CreateAsync()
    {
        var factory = new IdentityApiFactory();
        await factory._database.StartAsync();
        await FgpMigrator.ApplyAsync(factory._database.GetConnectionString());
        return factory;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:Fgp", _database.GetConnectionString());
        builder.ConfigureServices(services =>
        {
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
        await _database.DisposeAsync();
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
    public WorkerResponse Response { get; set; } = new(HttpStatusCode.OK, "{\"found\":false,\"amenities\":[]}");

    public Task<WorkerResponse> PostAsync<TRequest>(string path, TRequest request, CancellationToken cancellationToken)
    {
        LastPath = path;
        LastRequest?.Dispose();
        LastRequest = JsonSerializer.SerializeToDocument(request);
        return Task.FromResult(Response);
    }
}
