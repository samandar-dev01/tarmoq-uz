// Finished sentences, for the SERVER boundary (`handle()` in src/lib/http.ts). Not imported by client code: it pulls
// in ru/errors.ts, which the browser never needs.
import type { Locale } from "./config";
import { interpolate, type Params } from "./dictionary";
import { RU } from "./ru";
import { errors } from "./ru/errors";

/** Everything the server can say: the server-only fragment plus the ones the pages use. */
export const RU_SERVER: Record<string, string> = { ...errors, ...RU };

type Pattern = { key: string; names: string[]; regex: RegExp; fixed: number };
let patterns: Pattern[] | null = null;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every Russian entry whose key has placeholders, as a pattern that recognises the finished Uzbek sentence. */
function templatePatterns(): Pattern[] {
  if (patterns) return patterns;
  patterns = [];
  for (const key of Object.keys(RU_SERVER)) {
    const names: string[] = [];
    const parts = key.split(/\{(\w+)\}/g); // text, name, text, name, text
    if (parts.length < 3) continue;
    let source = "";
    let fixed = 0;
    parts.forEach((part, i) => {
      if (i % 2 === 0) {
        source += escapeRegex(part);
        fixed += part.length;
      } else {
        names.push(part);
        source += "([\\s\\S]+?)";
      }
    });
    patterns.push({ key, names, regex: new RegExp(`^${source}$`), fixed });
  }
  // The template with the most fixed text is the most exact one: try it first.
  patterns.sort((a, b) => b.fixed - a.fixed);
  return patterns;
}

/**
 * Translates a sentence that is already finished (an `HttpError` message, a zod message): an exact entry first, then a
 * template whose placeholders were filled in by `msg` (or by hand). Unknown text comes back unchanged.
 */
export function translateRendered(locale: Locale, text: string): string {
  if (locale !== "ru") return text;
  const exact = RU_SERVER[text];
  if (exact !== undefined) return exact;
  for (const p of templatePatterns()) {
    const m = p.regex.exec(text);
    if (!m) continue;
    const params: Params = {};
    p.names.forEach((name, i) => (params[name] = m[i + 1]!));
    return interpolate(RU_SERVER[p.key]!, params);
  }
  return text;
}
