using FGP.Api.Data;
using FGP.Api.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
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
    })
    .AddEntityFrameworkStores<FgpDbContext>()
    .AddDefaultTokenProviders();
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
});
builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection("Email"));
builder.Services.AddScoped<IEmailSender<ApplicationUser>, SmtpIdentityEmailSender>();
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

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new HealthResponse("ok")));
app.MapAuthEndpoints();

app.Run();

public sealed record HealthResponse(string Status);

public partial class Program;
