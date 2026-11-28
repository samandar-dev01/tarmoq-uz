// The suggestions offered while someone types in a search box. Pure: matching and the catalog part.
import type { Locale } from "../i18n/config";
import { CATALOG, catalogName } from "./catalog";

export type Suggestion = { label: string; kind: "category" | "creator" | "service"; href: string };

/** What the reader typed and what is compared with it, without case and without any apostrophe («toy» finds «Toʻy»). */
export const normalize = (text: string): string => text.toLocaleLowerCase("uz").replace(/[ʻʼ'’‘`]/g, "").replace(/\s+/g, " ").trim();

/** Directions and subdirections whose name, in either language, holds the typed text. `href` has no language prefix. */
export function catalogSuggestions(locale: Locale, query: string, limit = 4): Suggestion[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const out: Suggestion[] = [];
  for (const c of CATALOG) {
    if ([c.name, c.nameRu].some((n) => normalize(n).includes(q))) out.push({ label: catalogName(locale, c), kind: "category", href: `/search?category=${c.slug}` });
    for (const s of c.subcategories) {
      if ([s.name, s.nameRu].some((n) => normalize(n).includes(q))) out.push({ label: catalogName(locale, s), kind: "category", href: `/search?sub=${s.slug}&category=${c.slug}` });
    }
  }
  return out.slice(0, limit);
}
