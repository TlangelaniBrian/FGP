namespace FGP.Api.Organizations;

public interface IOrganizationInvitationSender
{
    Task SendInvitationAsync(string email, string invitationLink);
}
