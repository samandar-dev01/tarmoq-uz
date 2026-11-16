/** Whether `href` is the page you are on (or a page below it). `exact` asks for the very page. A query string in `href` is ignored. */
export function isCurrentPath(pathname: string, href: string, exact = false): boolean {
  const path = href.split("?")[0]!;
  return exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
}
