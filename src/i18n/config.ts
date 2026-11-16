// The two languages of the site and the ONE switch that decides whether Russian exists at all.
// This file is pure (no next/headers), so the proxy, the client and the unit tests can import it.

export type Locale = "uz" | "ru";
export const LOCALES = ["uz", "ru"] as const satisfies readonly Locale[];
export const DEFAULT_LOCALE: Locale = "uz";

/** The visitor's choice. Holds no secret and is not httpOnly: the language button writes it in the browser. */
export const LANG_COOKIE = "lang";
/** Request header the proxy sets on a `/ru/...` address, so the page knows its language without a cookie (crawlers have none). */
export const LOCALE_HEADER = "x-locale";

/**
 * THE switch. While it is false nothing Russian is reachable: no language button, `/ru/...` is a 404 as before, every
 * page and every API answer is Uzbek whatever cookie or header a request carries. The last language branch sets it to true.
 */
export const RUSSIAN_LIVE = false;

/**
 * Whether Russian is on for this server process: the constant above, or the environment variable `RUSSIAN_LIVE=1`
 * (read when the server runs, not when it is built), which exists for tests and local work only. Never set it on the
 * live site. SERVER ONLY: in the browser the variable does not exist, so client components never call this; they get
 * the answer from the server (the locale in `LocaleProvider`, the button rendered or not by the header).
 */
export const russianLive = (): boolean => RUSSIAN_LIVE || process.env.RUSSIAN_LIVE === "1";

/** Only the exact word "ru" is Russian; anything else (no cookie, a stray value) is Uzbek. */
export const parseLocale = (value: string | null | undefined): Locale => (value === "ru" ? "ru" : DEFAULT_LOCALE);

export const otherLocale = (locale: Locale): Locale => (locale === "uz" ? "ru" : "uz");

/** Each language's own name, and the short code the language button shows. */
export const LOCALE_NAME: Record<Locale, string> = { uz: "Oʻzbekcha", ru: "Русский" };
export const LOCALE_CODE: Record<Locale, string> = { uz: "UZ", ru: "RU" };
/** Open Graph locale names. */
export const OG_LOCALE: Record<Locale, string> = { uz: "uz_UZ", ru: "ru_RU" };

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
export const LANG_COOKIE_MAX_AGE = ONE_YEAR_SECONDS;
/** The text to assign to `document.cookie`. */
export const langCookie = (locale: Locale): string => `${LANG_COOKIE}=${locale}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;

/** The value of one cookie in a raw `Cookie` header, or undefined. */
function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

/**
 * The language of a request, from its own headers: the proxy's `x-locale` first, then the `lang` cookie, else Uzbek.
 * Always Uzbek while Russian is off. `live` is a parameter only so that tests can set it.
 */
export function resolveLocale(header: string | null | undefined, cookie: string | null | undefined, live: boolean = russianLive()): Locale {
  if (!live) return DEFAULT_LOCALE;
  return header === "ru" ? "ru" : parseLocale(cookie);
}

/** For route handlers and `handle()` (src/lib/http.ts), which have the Request in hand. */
export const localeOfRequest = (req: Request, live: boolean = russianLive()): Locale =>
  resolveLocale(req.headers.get(LOCALE_HEADER), cookieValue(req.headers.get("cookie"), LANG_COOKIE), live);
