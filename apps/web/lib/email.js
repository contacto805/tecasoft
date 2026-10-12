export async function sendEmail({ to, subject, text, html }) {
  // Placeholder — no email provider configured yet.
  // Enable Postmark, Resend, or another provider in Integrations to send real emails.
  console.log("[Email] Would send email:");
  console.log("[Email]   To:", to);
  console.log("[Email]   Subject:", subject);
  if (text) console.log("[Email]   Body:", text.substring(0, 100));
  console.log("[Email] Configure an email provider in Integrations to send real emails.");
}
