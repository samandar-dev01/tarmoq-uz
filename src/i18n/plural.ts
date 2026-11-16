// Counted words. Written by hand (no `Intl`), so the server and the browser always agree.
import type { Locale } from "./config";

export type RuForms = readonly [one: string, few: string, many: string];

/** The Russian form for a whole number: 1 отзыв, 2 отзыва, 5 отзывов, 11 отзывов, 21 отзыв, 22 отзыва, 25 отзывов. */
export function pluralRu(n: number, forms: RuForms): string {
  const abs = Math.abs(Math.trunc(n));
  const lastTwo = abs % 100;
  const last = abs % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

/**
 * A number with its word: `plural(locale, 5, "sharh", ["отзыв", "отзыва", "отзывов"])` is "5 ta sharh" in Uzbek
 * (the Uzbek word never changes) and "5 отзывов" in Russian.
 */
export function plural(locale: Locale, n: number, uzWord: string, ru: RuForms): string {
  return locale === "ru" ? `${n} ${pluralRu(n, ru)}` : `${n} ta ${uzWord}`;
}
