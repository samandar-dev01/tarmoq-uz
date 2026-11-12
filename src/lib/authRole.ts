import { safeNext } from "./safeNext";

/** The two public ways in. Admins sign in through either; they have no entry of their own. */
export type EntryRole = "client" | "provider";

export const parseEntryRole = (v: string | string[] | undefined | null): EntryRole =>
  (Array.isArray(v) ? v[0] : v) === "provider" ? "provider" : "client";

/** /login or /register with the role, and the `next` target when it is a safe same-site path. */
export function authHref(page: "/login" | "/register", role: EntryRole, next?: string | null): string {
  const qs = new URLSearchParams({ role });
  const safe = safeNext(next);
  if (safe) qs.set("next", safe);
  return `${page}?${qs.toString()}`;
}

/** One-time message carried across a redirect (read and cleared by <FlashToast />). */
export const FLASH_KEY = "tarmoq:flash";
