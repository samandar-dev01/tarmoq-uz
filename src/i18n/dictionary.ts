// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// HOW TEXT IS TRANSLATED ON THIS SITE (public API of src/i18n; keep it stable, other branches build on it)
//
// The Uzbek sentence IS the key (gettext style). Uzbek output is the key itself, byte for byte; Russian is looked up
// in src/i18n/ru/*.ts and falls back to the Uzbek key when an entry is missing. Values go in as `{name}` placeholders.
//
//   Server component / page / generateMetadata      import { getT, getLocale } from "@/i18n/server";
//       const t = await getT();                      t("Kirish")            t("Salom, {name}!", { name })
//   Client component ("use client")                 import { useT, useLocale } from "@/i18n/client";
//       const t = useT();                            t("Chiqish")
//   Text kept in a table outside a component        import { tk } from "@/i18n/dictionary";
//       const LABEL = { dark: tk("Yorugʻ rejimga oʻtish") };   ...later, inside the component:   t(LABEL[theme])
//       `tk` returns its argument unchanged; it only marks the literal so the completeness test can see it.
//   Server errors (route handlers, src/lib)         nothing to do at the throw site:
//       throw new HttpError(404, "Buyurtma topilmadi.")  and zod messages are translated by `handle()` at the
//       boundary (src/lib/http.ts) for the language of the request. They only need a Russian entry.
//   A server message with a value in it             import { msg } from "@/i18n/dictionary";
//       throw new HttpError(413, msg("Fayl {max} MB dan katta boʻlmasin.", { max }))      (also for zod messages)
//       `msg` returns the finished Uzbek sentence; the boundary recognises it again from the template's Russian entry.
//   Counted words                                   import { plural } from "@/i18n/plural";
//       plural(locale, 5, "sharh", ["отзыв", "отзыва", "отзывов"])    ->  "5 ta sharh" / "5 отзывов"
//   Links on PUBLIC pages (home, search, creator)   import { localHref, hreflang } from "@/i18n/paths";
//       <Link href={localHref(locale, "/search")}>   alternates: { languages: hreflang("/search") }
//   Money, dates                                    formatUZS(n, locale), formatDay(d, locale) ... (src/lib/format.ts)
//   Cities, languages, roles, categories            labelFor(locale, "Toshkent"), categoryName(locale, c) (src/lib/constants.ts)
//
// RULES
//   - Write the key as a plain string literal with double quotes, on one line, straight inside t( / tk( / msg(.
//     A key built at run time cannot be found by tests/unit/i18nCompleteness.test.ts.
//   - A Russian entry has exactly the same `{placeholders}` as its key. Never put `ʻ` or `ʼ` in Russian text.
//   - Each area has its own fragment (src/i18n/ru/<area>.ts). One key lives in ONE fragment (the test fails on a
//     key that two fragments translate differently). Shared words ("Bosh sahifaga qaytish") are in common.ts.
//   - ru/errors.ts is for text only the SERVER says (HttpError, zod, msg). It is kept out of the browser bundle, so a
//     key used with t( / tk( must be in another fragment.
//   - Russian is behind `RUSSIAN_LIVE` (src/i18n/config.ts): while it is off, `getLocale()` is always "uz".
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import type { Locale } from "./config";
import { RU } from "./ru";

export type Params = Record<string, string | number>;
/** What `getT()` and `useT()` hand back. */
export type Translator = (key: string, params?: Params) => string;

/** Fills `{name}` placeholders. A placeholder with no value is left as written. */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/** The one translation function. Pure: the same input always gives the same text, on the server and in the browser. */
export function translate(locale: Locale, key: string, params?: Params): string {
  const template = locale === "ru" ? (RU[key] ?? key) : key;
  return interpolate(template, params);
}

export const translator = (locale: Locale): Translator => (key, params) => translate(locale, key, params);

/** Marks a literal as a translation key (see the header). Returns it unchanged. */
export const tk = <T extends string>(key: T): T => key;

/** A server message with values: returns the Uzbek sentence. `translateRendered` (./rendered.ts) finds the template again. */
export const msg = (template: string, params: Params): string => interpolate(template, params);
