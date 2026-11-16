// Addresses and languages. Pure: used by the proxy, the header, the language button and the unit tests.
//
// The cookie `lang` is the truth for people. Only three kinds of page also have a Russian ADDRESS, for search engines
// (a crawler carries no cookie): `/ru`, `/ru/search` and `/ru/providers/<slug>`. Everything else has one address.
import { russianLive, type Locale } from "./config";

export const RU_PREFIX = "/ru";

const splitPath = (href: string): [string, string] => {
  const at = href.search(/[?#]/);
  return at < 0 ? [href, ""] : [href.slice(0, at), href.slice(at)];
};

/** True for the pages that have a Russian address: the home page, the search and a creator's page (path without `/ru`). */
export function isPublicPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/search" || /^\/providers\/[^/]+$/.test(pathname);
}

/** `/ru` -> `/`, `/ru/search` -> `/search`; any other path comes back unchanged. */
export function stripLocalePrefix(pathname: string): string {
  if (pathname === RU_PREFIX) return "/";
  return pathname.startsWith(`${RU_PREFIX}/`) ? pathname.slice(RU_PREFIX.length) : pathname;
}

/**
 * The address of an internal link for a visitor reading in `locale`. In Russian the public pages get the `/ru` prefix
 * (`/` -> `/ru`, `/search?city=x` -> `/ru/search?city=x`, `/providers/a` -> `/ru/providers/a`); every other path, and
 * every path in Uzbek, is returned as it is. `href` is a site path without a language prefix.
 */
export function localHref(locale: Locale, href: string): string {
  if (locale !== "ru") return href;
  const [path, rest] = splitPath(href);
  if (!isPublicPath(path)) return href;
  return (path === "/" ? RU_PREFIX : RU_PREFIX + path) + rest;
}

/**
 * `alternates.languages` for the metadata of a PUBLIC page: its Uzbek address, its Russian one and x-default (Uzbek).
 * `path` is the unprefixed path. Undefined while Russian is off, or for a page that has no Russian address, so the
 * caller can pass the result straight on: `alternates: { canonical: localHref(locale, path), languages: hreflang(path) }`.
 */
export function hreflang(path: string, live: boolean = russianLive()): Record<string, string> | undefined {
  const [pathname] = splitPath(path);
  if (!live || !isPublicPath(pathname)) return undefined;
  return { uz: path, ru: localHref("ru", path), "x-default": path };
}

/** What the proxy does with a request (src/proxy.ts). */
export type ProxyDecision =
  | { kind: "pass" } // not ours, or Russian is off: the request goes on untouched (a `/ru/...` address is then a 404, as before)
  | { kind: "rewrite"; to: string } // show the page at `to` in Russian, the address bar keeps `/ru/...`
  | { kind: "redirect"; to: string }; // this page has no Russian address: go to `to` (permanent)

/** The proxy's whole decision, from the path alone. `live` says whether Russian is on. */
export function proxyDecision(pathname: string, live: boolean): ProxyDecision {
  if (!live) return { kind: "pass" };
  if (pathname !== RU_PREFIX && !pathname.startsWith(`${RU_PREFIX}/`)) return { kind: "pass" };
  // A trailing slash is not part of the page's name ("/ru/" is "/ru").
  const bare = stripLocalePrefix(pathname).replace(/(.)\/+$/, "$1");
  // `/ru/ru/...` must never loop: peel every prefix before deciding.
  if (bare === RU_PREFIX || bare.startsWith(`${RU_PREFIX}/`)) return { kind: "redirect", to: stripAll(bare) };
  return isPublicPath(bare) ? { kind: "rewrite", to: bare } : { kind: "redirect", to: bare };
}

function stripAll(pathname: string): string {
  let p = pathname;
  while (p === RU_PREFIX || p.startsWith(`${RU_PREFIX}/`)) p = stripLocalePrefix(p);
  return p;
}
