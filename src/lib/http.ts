import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { localeOfRequest } from "../i18n/config";
import { translateRendered } from "../i18n/rendered";
import { readBodyLimited } from "./body";
import { HttpError } from "./errors";
export { HttpError };

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * SECURITY FIX (vibeguard #9): a second wall against cross-site form posts, on top of the SameSite=Lax cookie.
 * A browser always sends `Origin` on a cross-site POST and a page cannot change it, so a request whose Origin
 * is not this site is refused. A request with no Origin at all (curl, the test suite, a server) is not a
 * browser acting for a stranger's page, so it passes.
 */
export function sameOriginOk(req: Request): boolean {
  if (SAFE_METHODS.has(req.method)) return true;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false; // "null" and other unreadable origins
  }
  const own = [req.headers.get("host"), req.headers.get("x-forwarded-host")];
  if (process.env.APP_URL) {
    try {
      own.push(new URL(process.env.APP_URL).host);
    } catch {
      /* a bad APP_URL just adds nothing */
    }
  }
  return own.some((h) => !!h && h.toLowerCase() === originHost);
}

/**
 * Wrap every route handler: converts HttpError / ZodError / unknown errors into JSON responses.
 *
 * This is also where the server's words are translated. A handler throws its Uzbek sentence as always
 * (`new HttpError(404, "Buyurtma topilmadi.")`, a zod message); here it is put into the language of the request
 * (the proxy's `x-locale` header, then the `lang` cookie; see src/i18n). In Uzbek the text passes through unchanged.
 */
export function handle<A extends unknown[]>(fn: (req: Request, ...args: A) => Promise<Response>) {
  return async (req: Request, ...args: A): Promise<Response> => {
    try {
      if (!sameOriginOk(req)) throw new HttpError(403, "Soʻrov boshqa saytdan yuborilgan va rad etildi.");
      return await fn(req, ...args);
    } catch (e) {
      const say = (text: string) => translateRendered(localeOfRequest(req), text);
      if (e instanceof HttpError) {
        return NextResponse.json({ error: say(e.message), details: e.details }, { status: e.status, headers: e.headers });
      }
      if (e instanceof ZodError) {
        return NextResponse.json(
          {
            error: say("Belgilangan maydonlarni tekshiring."),
            fieldErrors: e.flatten((issue) => say(issue.message)).fieldErrors,
            issues: e.issues.map((i) => ({ path: i.path.join("."), message: say(i.message) })),
          },
          { status: 400 },
        );
      }
      console.error("Unhandled API error:", e);
      return NextResponse.json({ error: say("Nimadir xato ketdi. Qayta urinib koʻring.") }, { status: 500 });
    }
  };
}

/**
 * SECURITY FIX (vibeguard #4, #5): every JSON body is capped at 256 KB while it is being read. Nothing the app
 * accepts comes near that, and it also keeps an attacker from posting a giant array to run the validator
 * out of memory (the zod advisory GHSA-mrhx-c7xc-m3w5).
 */
const MAX_JSON_BYTES = 256 * 1024;

export async function readJson(req: Request, maxBytes = MAX_JSON_BYTES): Promise<unknown> {
  const body = await readBodyLimited(req, maxBytes, "Soʻrov juda katta.");
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw new HttpError(400, "Soʻrov notoʻgʻri shaklda yuborildi.");
  }
}

/**
 * The visitor's address, for rate limits and the "accepted from" record.
 *
 * SECURITY FIX (vibeguard #3): the first X-Forwarded-For entry is whatever the visitor typed, because Render
 * adds to that header and never clears it, so it can not be trusted. Two sources can:
 *  1. `CF-Connecting-IP`: Cloudflare sits in front of Render and overwrites this header on every request.
 *     (If the site ever moves to a host without Cloudflare in front, remove this line.)
 *  2. the LAST X-Forwarded-For entry: the one added by the platform's own proxy, not by the visitor.
 * Anything that is not a real IP address is ignored, so nobody can fill the limiter with made-up keys.
 */
export function clientIp(req: Request): string {
  const cloudflare = req.headers.get("cf-connecting-ip")?.trim();
  if (cloudflare && isIP(cloudflare)) return cloudflare;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const last = forwarded[forwarded.length - 1];
  return last && isIP(last) ? last : "unknown";
}
