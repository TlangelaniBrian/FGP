using Microsoft.AspNetCore.WebUtilities;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Xunit;

namespace FGP.Api.Tests;

public sealed class DocumentContractTests
{
    private static readonly byte[] FakePdf = Encoding.UTF8.GetBytes("%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF");

    private static async Task<long> CreateListingAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/listings", new
        {
            address = "1 Demo Rd",
            municipality = "tshwane",
            sizeSqm = 1024,
            price = 950000,
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt64();
    }

    [Fact]
    public async Task Generate_creates_a_ready_document_with_a_downloadable_pdf()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        var listingId = await CreateListingAsync(client);
        app.WorkerClient.Response = new(HttpStatusCode.OK, "ignored", FakePdf);

        var created = await client.PostAsJsonAsync("/api/documents", new
        {
            listingId,
            municipality = "tshwane",
            forms = new[] { "zoning_certificate" },
            prefilledData = new { zoneCode = "RES3", address = "1 Demo Rd" },
        });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var documents = await created.Content.ReadFromJsonAsync<List<DocumentResponse>>();
        var document = Assert.Single(documents!);

        var generated = await client.PostAsync($"/api/documents/{document.Id}/download", null);

        if (generated.StatusCode != HttpStatusCode.OK)
        {
            Assert.Fail($"Generate returned {(int)generated.StatusCode}: {await generated.Content.ReadAsStringAsync()}");
        }
        var ready = await generated.Content.ReadFromJsonAsync<DocumentResponse>();
        Assert.Equal("ready", ready!.Status);
        Assert.False(string.IsNullOrWhiteSpace(ready.PdfUrl));

        var download = await client.GetAsync($"/api/documents/{document.Id}/download");
        Assert.Equal(HttpStatusCode.OK, download.StatusCode);
        Assert.Equal("application/pdf", download.Content.Headers.ContentType?.MediaType);
        Assert.Equal(FakePdf, await download.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Download_before_generation_returns_not_found()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        var listingId = await CreateListingAsync(client);

        var created = await client.PostAsJsonAsync("/api/documents", new
        {
            listingId,
            municipality = "tshwane",
            forms = new[] { "zoning_certificate" },
        });
        var documents = await created.Content.ReadFromJsonAsync<List<DocumentResponse>>();
        var document = Assert.Single(documents!);

        var download = await client.GetAsync($"/api/documents/{document.Id}/download");

        Assert.Equal(HttpStatusCode.NotFound, download.StatusCode);
    }

    [Fact]
    public async Task Generate_returns_bad_gateway_when_the_worker_fails()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);
        var listingId = await CreateListingAsync(client);
        app.WorkerClient.Response = new(HttpStatusCode.InternalServerError, "boom");

        var created = await client.PostAsJsonAsync("/api/documents", new
        {
            listingId,
            municipality = "tshwane",
            forms = new[] { "zoning_certificate" },
        });
        var documents = await created.Content.ReadFromJsonAsync<List<DocumentResponse>>();
        var document = Assert.Single(documents!);

        var generated = await client.PostAsync($"/api/documents/{document.Id}/download", null);

        Assert.Equal(HttpStatusCode.BadGateway, generated.StatusCode);
    }

    [Fact]
    public async Task Documents_are_isolated_between_organizations()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var firstClient = app.CreateClient();
        var secondClient = app.CreateClient();
        await RegisterConfirmAndSignInAsync(firstClient, app, "first-owner@example.test");
        await RegisterConfirmAndSignInAsync(secondClient, app, "second-owner@example.test");
        app.WorkerClient.Response = new(HttpStatusCode.OK, "ignored", FakePdf);

        var listingId = await CreateListingAsync(firstClient);
        var created = await firstClient.PostAsJsonAsync("/api/documents", new
        {
            listingId,
            municipality = "tshwane",
            forms = new[] { "zoning_certificate" },
        });
        var documents = await created.Content.ReadFromJsonAsync<List<DocumentResponse>>();
        var document = Assert.Single(documents!);

        var foreignGenerate = await secondClient.PostAsync($"/api/documents/{document.Id}/download", null);
        var foreignDownload = await secondClient.GetAsync($"/api/documents/{document.Id}/download");

        Assert.Equal(HttpStatusCode.NotFound, foreignGenerate.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, foreignDownload.StatusCode);
    }

    private static async Task RegisterConfirmAndSignInAsync(
        HttpClient client,
        IdentityApiFactory app,
        string email)
    {
        var registration = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "CorrectHorseBatteryStaple1!",
            displayName = "Owner Example",
            organizationName = "Example Club",
        });
        Assert.Equal(HttpStatusCode.Created, registration.StatusCode);

        var confirmationUri = new Uri(app.EmailSender.Emails.Single(message =>
            message.Kind == "confirmation" && message.Email == email).Link);
        var query = QueryHelpers.ParseQuery(confirmationUri.Query);
        var verification = await client.PostAsJsonAsync("/api/auth/verify-email", new
        {
            userId = query["userId"].Single(),
            token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(query["token"].Single()!)),
        });
        Assert.Equal(HttpStatusCode.NoContent, verification.StatusCode);

        var signIn = await client.PostAsJsonAsync("/api/auth/sign-in", new
        {
            email,
            password = "CorrectHorseBatteryStaple1!",
        });
        Assert.Equal(HttpStatusCode.NoContent, signIn.StatusCode);
    }

    private sealed record DocumentResponse(long Id, string DocType, string Status, string? PdfUrl);
}
