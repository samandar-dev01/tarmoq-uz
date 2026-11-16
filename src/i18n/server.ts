// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The language of the current request, for SERVER code (pages, layouts, server components, generateMetadata).
// The full guide is at the top of ./dictionary.ts.
//
//   const locale = await getLocale();   // "uz" | "ru": the proxy's `x-locale` header, then the `lang` cookie, else "uz".
//                                       // Always "uz" while Russian is off (RUSSIAN_LIVE in ./config.ts).
//   const t = await getT();             // t("Kirish"), t("Hisob menyusi: {name}", { name })
//
// Both read the request (headers and cookies), so a page that calls them is rendered per request; every page already
// is, because the root layout reads the session. Route handlers do not need this file: `handle()` translates their
// errors. A handler that needs the language itself uses `localeOfRequest(req)` from ./config.ts.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LANG_COOKIE, LOCALE_HEADER, resolveLocale, russianLive, type Locale } from "./config";
import { translator, type Translator } from "./dictionary";

export const getLocale = cache(async (): Promise<Locale> => {
  if (!russianLive()) return DEFAULT_LOCALE;
  return resolveLocale((await headers()).get(LOCALE_HEADER), (await cookies()).get(LANG_COOKIE)?.value, true);
});

export async function getT(): Promise<Translator> {
  return translator(await getLocale());
}
