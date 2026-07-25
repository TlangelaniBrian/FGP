using System.Net.Mail;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace FGP.Api.Identity;

public sealed class EmailOptions
{
    public string SmtpHost { get; init; } = "localhost";
    public int SmtpPort { get; init; } = 1025;
    public string FromAddress { get; init; } = "no-reply@fgp.local";
}

public sealed class SmtpIdentityEmailSender(IOptions<EmailOptions> options) : IEmailSender<ApplicationUser>
{
    public Task SendConfirmationLinkAsync(ApplicationUser user, string email, string confirmationLink) =>
        SendAsync(email, "Confirm your FGP email", $"Confirm your email: {confirmationLink}");

    public Task SendPasswordResetLinkAsync(ApplicationUser user, string email, string resetLink) =>
        SendAsync(email, "Reset your FGP password", $"Reset your password: {resetLink}");

    public Task SendPasswordResetCodeAsync(ApplicationUser user, string email, string resetCode) =>
        SendAsync(email, "Your FGP password reset code", $"Your reset code: {resetCode}");

    private async Task SendAsync(string recipient, string subject, string body)
    {
        using var message = new MailMessage(options.Value.FromAddress, recipient, subject, body);
        using var client = new SmtpClient(options.Value.SmtpHost, options.Value.SmtpPort);
        await client.SendMailAsync(message);
    }
}
