import { stripLocalePrefix } from "../i18n/paths";

/**
 * Whether `href` is the page you are on (or a page below it). `exact` asks for the very page. A query string in `href` is ignored.
 * The language prefix of a Russian address is not part of the page's name: `/ru/search` and `/search` are the same page. (The server
 * sees the page's real path after the proxy's rewrite, the browser sees the address bar's `/ru/search`; comparing without the
 * prefix gives both the same answer, so the first render in the browser matches the HTML.)
 */
export function isCurrentPath(pathname: string, href: string, exact = false): boolean {
  const path = stripLocalePrefix(href.split("?")[0]!);
  const here = stripLocalePrefix(pathname);
  return exact ? here === path : here === path || here.startsWith(`${path}/`);
}
