import "server-only";

export type EmailDeliveryStatus = "SENT" | "FAILED" | "SKIPPED";
export type SendEmailInput = { to: string; subject: string; body: string; linkPath: string };
export type SendEmailResult = { status: EmailDeliveryStatus; provider?: string; error?: string };

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function absoluteAppLink(linkPath: string) {
  const appUrl = process.env.APP_URL;
  if (!appUrl || !linkPath.startsWith("/")) return null;
  try { return new URL(linkPath, appUrl).toString(); }
  catch { return null; }
}

export async function sendEmail({ to, subject, body, linkPath }: SendEmailInput): Promise<SendEmailResult> {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (!provider) return { status: "SKIPPED" };
  if (provider !== "resend") {
    console.error(`Notification email skipped: unsupported provider "${provider}".`);
    return { status: "FAILED", provider, error: "Unsupported email provider." };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const link = absoluteAppLink(linkPath);
  if (!apiKey || !from || !link) {
    console.error("Notification email skipped: Resend credentials, sender, or APP_URL are incomplete.");
    return { status: "SKIPPED", provider };
  }

  const text = `${subject}\n\n${body}\n\nOpen Ordinora: ${link}`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#173c31"><h2 style="margin:0 0 12px">${escapeHtml(subject)}</h2><p>${escapeHtml(body)}</p><p><a href="${escapeHtml(link)}">Open in Ordinora</a></p></div>`;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
    });
    if (!response.ok) {
      console.error(`Notification email failed through Resend with HTTP ${response.status}.`);
      return { status: "FAILED", provider, error: `HTTP ${response.status}` };
    }
    return { status: "SENT", provider };
  } catch (error) {
    console.error("Notification email failed through Resend.", error);
    return { status: "FAILED", provider, error: error instanceof Error ? error.message : "Unknown email error." };
  }
}
