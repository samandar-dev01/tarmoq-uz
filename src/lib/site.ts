// The one place that knows the site's public address. Everything search engines and AI crawlers read (canonical
// links, the sitemap, robots.txt, Open Graph, JSON-LD, llms.txt) is built from it, so moving to a real domain is one
// setting: APP_URL. Read at request time on the server, never baked into the browser bundle.

/**
 * APP_URL, else the public URL Render gives every web service, else the local dev address. No trailing slash.
 * A value that is not an http(s) address is skipped, so a typo in APP_URL falls through to the next choice.
 * Called per request (never kept in a module constant), so a build made without APP_URL does not freeze "localhost".
 */
export function siteUrl(): string {
  for (const candidate of [process.env.APP_URL, process.env.RENDER_EXTERNAL_URL]) {
    const raw = (candidate ?? "").trim().replace(/\/+$/, "");
    if (!raw) continue;
    try {
      const u = new URL(raw);
      if (u.protocol === "http:" || u.protocol === "https:") return raw;
    } catch {
      /* an unreadable value is skipped */
    }
  }
  return "http://localhost:3000";
}

export const SITE_NAME = "Tarmoq.uz";

/** "/search?x=1" -> "https://site/search?x=1". The home page is the bare origin with a slash. */
export function absoluteUrl(path = "/", base: string = siteUrl()): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
