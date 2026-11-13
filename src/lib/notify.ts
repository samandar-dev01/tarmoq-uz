/**
 * Admin notifications over Telegram (the Bot API is free).
 *
 * Entirely optional: with no TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID set, every call here is a no-op, so
 * local development, tests and deployments without Telegram behave exactly as before.
 * Nothing in this file throws. A notification problem must never break the user's request.
 */

const TIMEOUT_MS = 4000;

/**
 * User-controlled text ends up in a plain-text message, so make it one line with no control characters
 * and a bounded length. That way a name cannot fake extra lines or links in the message.
 */
export function oneLine(value: string | null | undefined, max = 80): string {
  const cleaned = (value ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ") // control characters; \s below also collapses U+2028/2029
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

/** APP_URL if set, else the public URL Render provides to every web service, else nothing. */
const baseUrl = () => (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/+$/, "");

/** Name and city only. No email, phone or prices ever go into a Telegram message. */
export function profileSubmittedMessage(p: { name: string; city?: string | null }): string {
  const who = oneLine(p.name) || "(no name)";
  const city = oneLine(p.city, 40);
  const base = baseUrl();
  return [
    `New creator profile to review: ${who}${city ? `, ${city}` : ""}`,
    base ? `Review: ${base}/admin/providers` : "Review at /admin/providers",
  ].join("\n");
}

/** Sends a plain-text message to the configured chat. Resolves true if Telegram accepted it, never rejects. */
export async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // No parse_mode: the text is sent as-is, so nothing in it can be read as markup.
      body: JSON.stringify({ chat_id: chatId, text, link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).replaceAll(token, "***").slice(0, 200);
      console.error(`[notify] Telegram answered ${res.status}: ${detail}`);
      return false;
    }
    return true;
  } catch (err) {
    // Log the kind of failure only. The request URL contains the bot token, so never log it.
    const code = (err as { cause?: { code?: string } } | null)?.cause?.code;
    console.error(`[notify] Telegram request failed: ${err instanceof Error ? err.name : "unknown"}${code ? ` (${code})` : ""}`);
    return false;
  }
}

export const notifyProfileSubmitted = (p: { name: string; city?: string | null }) =>
  sendTelegram(profileSubmittedMessage(p));
