// Pure rules for the support inbox (no database, no network), so they can be unit-tested.

/** One alert to the owner per thread per this long, however many messages arrive in between. */
export const SUPPORT_ALERT_EVERY_MS = 10 * 60 * 1000;

/** The longest message to the support team. */
export const SUPPORT_MAX_CHARS = 1500;

/** The support team's Telegram, offered next to the on-site thread (anyone can use it, signed in or not). */
export const SUPPORT_TELEGRAM_URL = "https://t.me/justuzbe";

/** True when a new message should also ping the owner on Telegram: never pinged yet, or the last ping is old enough. */
export function shouldAlert(lastAlertAt: Date | null, now: Date = new Date()): boolean {
  return !lastAlertAt || now.getTime() - lastAlertAt.getTime() >= SUPPORT_ALERT_EVERY_MS;
}

/** Staff messages the person has not opened yet (the thread's `userReadAt` is when they last looked). */
export function unreadForUser(messages: { fromStaff: boolean; createdAt: Date }[], userReadAt: Date | null): number {
  return messages.filter((m) => m.fromStaff && (!userReadAt || m.createdAt > userReadAt)).length;
}

/** True when the person wrote last and no admin has opened the thread since: it needs an answer. */
export function needsAnswer(t: { lastMessageAt: Date; staffReadAt: Date | null; lastFromStaff: boolean }): boolean {
  return !t.lastFromStaff && (!t.staffReadAt || t.lastMessageAt > t.staffReadAt);
}
