import type { Locale } from "../i18n/config";
import { translate } from "../i18n/dictionary";

export const CITIES = [
  "Andijon", "Toshkent", "Samarqand", "Buxoro", "Namangan",
  "Fargʻona", "Qoʻqon", "Nukus", "Qarshi", "Termiz",
] as const;

export const LANGUAGES = ["Oʻzbek", "Rus", "Ingliz", "Qoraqalpoq", "Tojik"] as const;

export const SORTS = {
  rating: "Reyting boʻyicha",
  price_asc: "Narx: arzondan qimmatga",
  price_desc: "Narx: qimmatdan arzonga",
  newest: "Eng yangilari",
} as const;

export const PAGE_SIZE = 12;

/**
 * What a reader sees for a stored value: a city, a language, a role («Toshkent» -> «Ташкент» in Russian). The stored
 * value itself never changes; filters and the database keep the Uzbek word. The Russian words are in
 * src/i18n/ru/labels.ts; a value with no entry (something a creator typed) is shown as written.
 */
export const labelFor = (locale: Locale, value: string): string => translate(locale, value);

/** A category's name for the reader: the Russian name when there is one, else the stored (Uzbek) name. */
export const categoryName = (locale: Locale, category: { name: string; nameRu?: string | null }): string =>
  locale === "ru" && category.nameRu ? category.nameRu : category.name;
