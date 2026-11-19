// Addresses of the public search and creator pages, in the reader's language. Pure, so the unit tests can check that a
// Russian page only ever links to `/ru/...` (a crawler has no cookie, so the address itself has to say the language).
// Private pages (sign-in, orders, messages) are never prefixed: `localHref` leaves them alone.
import type { Locale } from "../i18n/config";
import { localHref } from "../i18n/paths";
import type { SearchFilters } from "./providers";

/** A creator's page: `/providers/<slug>` or `/ru/providers/<slug>`. */
export const providerHref = (locale: Locale, slug: string): string => localHref(locale, `/providers/${slug}`);

/** The search page with these filters and this page number (the first page has no `page` parameter). */
export function searchPageHref(locale: Locale, filters: SearchFilters, page: number): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "" && k !== "page") qs.set(k, String(v));
  }
  if (page > 1) qs.set("page", String(page));
  return localHref(locale, `/search?${qs.toString()}`);
}

/**
 * What a chip link carries over: every filter that is set, except the page number and the default order. `?sort=rating` is
 * the same list as no `sort` at all, and leaving it out keeps the chip's address the clean one a search engine indexes.
 */
const carried = (k: string, v: unknown): boolean => v !== undefined && v !== "" && k !== "page" && !(k === "sort" && v === "rating");

/**
 * A category pill changes only the category: every other filter stays and the page number starts over. With no `slug`
 * it is the "all categories" pill.
 */
export function searchCategoryHref(locale: Locale, filters: SearchFilters, slug?: string): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (carried(k, v) && k !== "category") qs.set(k, String(v));
  }
  if (slug) qs.set("category", slug);
  const query = qs.toString();
  return localHref(locale, query ? `/search?${query}` : "/search");
}

/** The same for a city chip: it changes only the city, every other filter stays and the page number starts over. With no `city` it is the "all cities" chip. */
export function searchCityHref(locale: Locale, filters: SearchFilters, city?: string): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (carried(k, v) && k !== "city") qs.set(k, String(v));
  }
  if (city) qs.set("city", city);
  const query = qs.toString();
  return localHref(locale, query ? `/search?${query}` : "/search");
}
