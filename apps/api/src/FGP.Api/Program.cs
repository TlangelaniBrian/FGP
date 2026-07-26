using FGP.Api.Data;
using FGP.Api.Feasibility;
using FGP.Api.Identity;
using FGP.Api.Organizations;
using FGP.Api.Projects;
using FGP.Api.Spatial;
using FGP.Api.Tariffs;
using FGP.Api.CapitalFund;
using FGP.Api.Portal;
using FGP.Api.Data.Seed;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Fgp")
    ?? throw new InvalidOperationException("ConnectionStrings:Fgp is required.");

builder.Services.AddDbContext<FgpDbContext>(options =>
    options.UseNpgsql(connectionString, npgsql => npgsql.UseNetTopologySuite()));
builder.Services
    .AddIdentity<ApplicationUser, IdentityRole<Guid>>(options =>
    {
        options.SignIn.RequireConfirmedEmail = true;
        options.User.RequireUniqueEmail = true;
        options.Lockout.AllowedForNewUsers = true;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    })
    .AddEntityFrameworkStores<FgpDbContext>()
    .AddDefaultTokenProviders();
builder.Services.AddScoped<IUserClaimsPrincipalFactory<ApplicationUser>, ApplicationUserClaimsPrincipalFactory>();
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    };
});
builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection("Email"));
builder.Services.AddScoped<SmtpIdentityEmailSender>();
builder.Services.AddScoped<IEmailSender<ApplicationUser>>(services => services.GetRequiredService<SmtpIdentityEmailSender>());
builder.Services.AddScoped<IOrganizationInvitationSender>(services => services.GetRequiredService<SmtpIdentityEmailSender>());
builder.Services
    .AddOptions<WorkerOptions>()
    .Bind(builder.Configuration.GetSection("Worker"))
    .Validate(
        options => !string.IsNullOrWhiteSpace(options.ServiceToken),
        "Worker:ServiceToken is required.")
    .ValidateOnStart();
builder.Services.AddHttpClient<IWorkerClient, HttpWorkerClient>(client =>
{
    var workerBaseUrl = builder.Configuration["Worker:BaseUrl"] ?? throw new InvalidOperationException("Worker:BaseUrl is required.");
    client.BaseAddress = new Uri(workerBaseUrl);
    client.Timeout = Timeout.InfiniteTimeSpan;
});
builder.Services
    .AddOptions<AnalysisEndpointOptions>()
    .Bind(builder.Configuration.GetSection("Analysis"))
    .Validate(
        options => options.EndpointTimeoutMilliseconds is > 0 and < 10_000,
        "Analysis endpoint timeout must be greater than zero and less than ten seconds.")
    .ValidateOnStart();
builder.Services.AddScoped<FeasibilityRepository>();
builder.Services.AddScoped<GovernanceService>();
builder.Services.AddScoped<IAuthorizationHandler, CapabilityAuthorizationHandler>();
builder.Services.AddAuthorization(options =>
{
    foreach (var capability in Capabilities.All)
    {
        options.AddPolicy(capability, policy => policy
            .RequireAuthenticatedUser()
            .AddRequirements(new CapabilityRequirement(capability)));
    }
});

var app = builder.Build();

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
        var logger = context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("UnhandledRequest");
        logger.LogError(exception, "Unhandled exception while processing {Method} {Path}", context.Request.Method, context.Request.Path);
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/problem+json";
        await context.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "Internal server error",
            Detail = "An unexpected error occurred.",
        });
    });
});

if (args.Contains("--seed-demo", StringComparer.Ordinal))
{
    if (!Guid.TryParse(builder.Configuration["Seed:OrganizationId"], out var seedOrganizationId))
    {
        throw new InvalidOperationException("Seed:OrganizationId must be a UUID when --seed-demo is used.");
    }
    await using var seedScope = app.Services.CreateAsyncScope();
    var seedDatabase = seedScope.ServiceProvider.GetRequiredService<FgpDbContext>();
    await seedDatabase.Database.MigrateAsync();
    await ReferenceDataSeeder.SeedAsync(seedDatabase, seedOrganizationId);
    await DemoSpatialDataSeeder.SeedAsync(seedDatabase);
    return;
}

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new HealthResponse("ok")));
app.MapAuthEndpoints();
app.MapOrganizationEndpoints();
app.MapProjectEndpoints();
app.MapCheckInEndpoints();
app.MapTariffEndpoints();
app.MapParcelEndpoints();
app.MapFeasibilityEndpoints();
app.MapCapitalFundEndpoints();
app.MapPortalEndpoints();

app.Run();

public sealed record HealthResponse(string Status);

public partial class Program;
