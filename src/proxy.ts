import { NextResponse, type NextRequest } from "next/server";
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE, LOCALE_HEADER, russianLive } from "@/i18n/config";
import { proxyDecision } from "@/i18n/paths";

// The site's only proxy, and it does one thing: the Russian ADDRESSES. It runs for `/ru` and `/ru/...` and nothing else.
// It is NOT an access guard: every page and every API route checks the session and the role itself.
//
//   Russian off (the default)   the request goes on untouched; there is no `/ru` page, so the answer is the 404 it always was.
//   `/ru`, `/ru/search`, `/ru/providers/<slug>`
//                               the unprefixed page is shown, with the request header `x-locale: ru` (src/i18n/server.ts reads
//                               it), so a crawler without cookies gets Russian. A visitor with no `lang` cookie gets `lang=ru`.
//   any other `/ru/...`         a permanent redirect (308) to the same path without the prefix: those pages have one address.
//
// The decision itself is the pure function `proxyDecision` (unit tested).
export function proxy(req: NextRequest) {
  const decision = proxyDecision(req.nextUrl.pathname, russianLive());
  if (decision.kind === "pass") return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = decision.to;
  if (decision.kind === "redirect") return NextResponse.redirect(url, 308);

  const headers = new Headers(req.headers);
  headers.set(LOCALE_HEADER, "ru");
  const res = NextResponse.rewrite(url, { request: { headers } });
  if (!req.cookies.has(LANG_COOKIE)) {
    res.cookies.set(LANG_COOKIE, "ru", { path: "/", maxAge: LANG_COOKIE_MAX_AGE, sameSite: "lax" });
  }
  return res;
}

export const config = { matcher: "/ru/:path*" };
