using FGP.Api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Fgp")
    ?? throw new InvalidOperationException("ConnectionStrings:Fgp is required.");

builder.Services.AddDbContext<FgpDbContext>(options =>
    options.UseNpgsql(connectionString, npgsql => npgsql.UseNetTopologySuite()));

var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new HealthResponse("ok")));

app.Run();

public sealed record HealthResponse(string Status);

public partial class Program;
