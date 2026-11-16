import type { Locale } from "../i18n/config";

const grouped = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/**
 * 1500000 -> "1 500 000 soʻm", in Russian "1 500 000 сум" (non-breaking spaces, so a price never splits across lines).
 * Left out, the language is Uzbek.
 */
export const formatUZS = (n: number, locale: Locale = "uz") => `${grouped(n)} ${locale === "ru" ? "сум" : "soʻm"}`;

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

/** "Demo Client" -> "Demo C." (keeps reviewer names short) */
export function shortName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1]![0]!.toUpperCase()}.` : first ?? "";
}

export function slugify(input: string) {
  const base = input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "creator";
}

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
// Russian month names in the genitive, as a date needs them: «10 ноября».
const MONTHS_RU = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
// Uzbekistan is UTC+5 all year (no daylight saving), so a fixed offset is exact.
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const two = (n: number) => String(n).padStart(2, "0");
const toTashkent = (d: Date) => new Date(d.getTime() + TASHKENT_OFFSET_MS);
/** "10-noyabr" / «10 ноября», from the UTC fields of `d`. */
const dayMonth = (d: Date, locale: Locale) =>
  locale === "ru" ? `${d.getUTCDate()} ${MONTHS_RU[d.getUTCMonth()]}` : `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}`;

// Every function below takes the language last; left out, it is Uzbek. No `Intl` and no clock: the server and the
// browser always write the same text.

/** A calendar date with no time of day (such as an event date, stored at 00:00 UTC): "10-noyabr, 2026" / «10 ноября 2026». */
export const formatDate = (d: Date, locale: Locale = "uz") =>
  locale === "ru" ? `${dayMonth(d, locale)} ${d.getUTCFullYear()}` : `${dayMonth(d, locale)}, ${d.getUTCFullYear()}`;

/** The day something happened, in Tashkent time: "10-noyabr, 2026" / «10 ноября 2026». */
export const formatDay = (d: Date, locale: Locale = "uz") => formatDate(toTashkent(d), locale);

/** The moment something happened, in Tashkent time: "10-noyabr, 19:30" / «10 ноября, 19:30». Safe on server and client. */
export function formatMoment(d: Date, locale: Locale = "uz") {
  const t = toTashkent(d);
  return `${dayMonth(t, locale)}, ${two(t.getUTCHours())}:${two(t.getUTCMinutes())}`;
}
