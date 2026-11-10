/** 1500000 -> "1 500 000 soʻm" (non-breaking spaces, so a price never splits across lines). */
export const formatUZS = (n: number) =>
  `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} soʻm`;

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
// Uzbekistan is UTC+5 all year (no daylight saving), so a fixed offset is exact.
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const two = (n: number) => String(n).padStart(2, "0");
const toTashkent = (d: Date) => new Date(d.getTime() + TASHKENT_OFFSET_MS);

/** A calendar date with no time of day (such as an event date, stored at 00:00 UTC): "10-noyabr, 2026". */
export const formatDate = (d: Date) => `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}, ${d.getUTCFullYear()}`;

/** The day something happened, in Tashkent time: "10-noyabr, 2026". */
export const formatDay = (d: Date) => formatDate(toTashkent(d));

/** The moment something happened, in Tashkent time: "10-noyabr, 19:30". Safe on server and client (no locale). */
export function formatMoment(d: Date) {
  const t = toTashkent(d);
  return `${t.getUTCDate()}-${MONTHS[t.getUTCMonth()]}, ${two(t.getUTCHours())}:${two(t.getUTCMinutes())}`;
}
