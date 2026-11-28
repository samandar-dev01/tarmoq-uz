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
 * A category pill changes only the category: every other filter stays and the page number starts over. With no `slug`
 * it is the "all categories" pill.
 */
export function searchCategoryHref(locale: Locale, filters: SearchFilters, slug?: string): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    // A subdirection belongs to the direction being left, so it goes with it.
    if (v !== undefined && v !== "" && k !== "page" && k !== "category" && k !== "sub") qs.set(k, String(v));
  }
  if (slug) qs.set("category", slug);
  const query = qs.toString();
  return localHref(locale, query ? `/search?${query}` : "/search");
}

/** A subdirection pill: every filter stays, the subdirection changes (none = all of the direction), page starts over. */
export function searchSubHref(locale: Locale, filters: SearchFilters, sub?: string): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "" && k !== "page" && k !== "sub") qs.set(k, String(v));
  }
  if (sub) qs.set("sub", sub);
  const query = qs.toString();
  return localHref(locale, query ? `/search?${query}` : "/search");
}
