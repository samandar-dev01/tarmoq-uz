/**
 * Gives the database address a connection limit when it does not already name one.
 *
 * Prisma opens (CPU count x 2 + 1) connections by default. A shared host reports its machine's cores, not the share this
 * app gets, so that can be 17 or more, while this app runs on a 512 MB instance and talks to Supabase through a pooler
 * that only allows a few dozen clients in all (and a deploy briefly runs the old and the new instance side by side).
 * Five connections are plenty for one small Node process, and they leave room.
 *
 * An address that already says `connection_limit=...` is left exactly as it is, so the owner can still choose in the
 * Render dashboard. The string is only appended to, never parsed and written back, so the password's escaping is untouched.
 */
export const DEFAULT_CONNECTION_LIMIT = 5;

export function withConnectionLimit(url: string, limit: number = DEFAULT_CONNECTION_LIMIT): string {
  if (/[?&]connection_limit=/i.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=${limit}`;
}
