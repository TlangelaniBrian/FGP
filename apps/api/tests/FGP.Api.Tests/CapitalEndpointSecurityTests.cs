using FGP.Api.Data;
using FGP.Api.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using Xunit;

namespace FGP.Api.Tests;

public sealed class CapitalEndpointSecurityTests
{
    [Fact]
    public async Task Capital_read_requires_an_active_membership_for_the_claimed_organization()
    {
        await using var app = await IdentityApiFactory.CreateAsync();
        var client = app.CreateClient();
        var actor = await ContractTestSession.RegisterConfirmAndSignInAsync(client, app);

        await using (var scope = app.Services.CreateAsyncScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<FgpDbContext>();
            var membership = await database.Memberships.SingleAsync(item =>
                item.UserId == actor.UserId && item.OrganizationId == actor.OrganizationId);
            membership.Status = MembershipStatus.Suspended;
            await database.SaveChangesAsync();
        }

        var response = await client.GetAsync("/api/capital/");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
