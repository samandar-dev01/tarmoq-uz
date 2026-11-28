// Who is around: pure rules over `User.lastSeenAt`.

/** Seen this recently counts as online. */
export const ONLINE_MS = 5 * 60 * 1000;
/** `lastSeenAt` is written at most this often, however many requests a person makes. */
export const TOUCH_MS = 60 * 1000;

const age = (lastSeenAt: Date | string | null | undefined, now: number): number => {
  const at = lastSeenAt ? new Date(lastSeenAt).getTime() : NaN;
  return Number.isFinite(at) ? now - at : Infinity;
};

export const isOnline = (lastSeenAt: Date | string | null | undefined, now = Date.now()): boolean => age(lastSeenAt, now) < ONLINE_MS;
export const touchDue = (lastSeenAt: Date | string | null | undefined, now = Date.now()): boolean => age(lastSeenAt, now) >= TOUCH_MS;

/**
 * How many hours a creator usually takes to answer: the middle value over their conversations, from the other person's
 * first message to the creator's first message after it. Whole hours, at least 1; null with fewer than 2 answers.
 */
export function usualResponseHours(conversations: { senderId: string; createdAt: Date }[][], creatorId: string): number | null {
  const waits: number[] = [];
  for (const messages of conversations) {
    const asked = messages.find((m) => m.senderId !== creatorId);
    if (!asked) continue;
    const answered = messages.find((m) => m.senderId === creatorId && m.createdAt > asked.createdAt);
    if (answered) waits.push(answered.createdAt.getTime() - asked.createdAt.getTime());
  }
  if (waits.length < 2) return null;
  waits.sort((a, b) => a - b);
  return Math.max(1, Math.ceil(waits[Math.floor((waits.length - 1) / 2)]! / (60 * 60 * 1000)));
}
