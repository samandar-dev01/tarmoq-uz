// The creators a visitor looked at last, kept in their own browser as a small cookie, so the home page can offer them
// again. Pure (no I/O). A slug holds only a-z, 0-9 and "-", so "." separates them.

export const SEEN_COOKIE = "seen";
export const SEEN_LIMIT = 8;
const SLUG = /^[a-z0-9-]{1,80}$/;
const THIRTY_DAYS = 30 * 24 * 60 * 60;

/** The cookie's value read back: only well-formed slugs, newest first, each once. */
export const parseSeen = (value: string | null | undefined): string[] =>
  [...new Set((value ?? "").split(".").filter((s) => SLUG.test(s)))].slice(0, SEEN_LIMIT);

/** The list after a visit: this creator first. */
export const addSeen = (list: readonly string[], slug: string): string[] => parseSeen([slug, ...list].join("."));

/** The text to assign to `document.cookie`. */
export const seenCookie = (list: readonly string[]): string => `${SEEN_COOKIE}=${list.join(".")}; Path=/; Max-Age=${THIRTY_DAYS}; SameSite=Lax`;

// Saved packages (the heart on a card), kept the same way: newest first, in this browser only.
export const SAVED_COOKIE = "saved";
export const SAVED_LIMIT = 40;
const ID = /^[a-z0-9]{1,40}$/;

export const parseSaved = (value: string | null | undefined): string[] =>
  [...new Set((value ?? "").split(".").filter((s) => ID.test(s)))].slice(0, SAVED_LIMIT);

/** The list after the heart is pressed: taken out when it was there, otherwise put first. */
export const toggleSaved = (list: readonly string[], id: string): string[] =>
  list.includes(id) ? list.filter((x) => x !== id) : parseSaved([id, ...list].join("."));

export const savedCookie = (list: readonly string[]): string => `${SAVED_COOKIE}=${list.join(".")}; Path=/; Max-Age=${THIRTY_DAYS * 6}; SameSite=Lax`;
