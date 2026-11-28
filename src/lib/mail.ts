// Email the site sends: password reset and address confirmation. OFF until the owner sets a sender: RESEND_API_KEY and
// MAIL_FROM (resend.com, an HTTP API, no extra package). MAIL_DRIVER=log writes the message to the server log instead,
// for development and tests only. Nothing here throws.

const log = () => process.env.MAIL_DRIVER === "log" && process.env.NODE_ENV !== "production";

export const mailEnabled = (): boolean => log() || !!(process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim());

export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (log()) {
    console.info(`[mail] to ${to}: ${subject}\n${text}`);
    return true;
  }
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  if (!key || !from) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    // The answer may repeat the address: only the status is logged.
    if (!res.ok) console.error(`[mail] the sender answered ${res.status}`);
    return res.ok;
  } catch (e) {
    console.error(`[mail] send failed: ${e instanceof Error ? e.name : "unknown"}`);
    return false;
  }
}
