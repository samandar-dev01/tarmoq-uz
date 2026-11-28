// Who is typing in which conversation right now. Held in this server's memory for a few seconds: nothing is stored, and
// with one instance (as the site runs) both people meet the same memory.
const TYPING_MS = 6000;
const until = new Map<string, number>();

export function noteTyping(conversationId: string, userId: string, now = Date.now()): void {
  until.set(`${conversationId}:${userId}`, now + TYPING_MS);
  // Old entries are swept when the map grows, so it can not grow for ever.
  if (until.size > 500) for (const [key, at] of until) if (at <= now) until.delete(key);
}

export const stopTyping = (conversationId: string, userId: string): void => void until.delete(`${conversationId}:${userId}`);

export const isTyping = (conversationId: string, userId: string, now = Date.now()): boolean => (until.get(`${conversationId}:${userId}`) ?? 0) > now;
