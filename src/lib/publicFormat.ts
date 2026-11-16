// A price that starts somewhere, for the public cards and the creator page. Pure (no `Intl`), like src/lib/format.ts.
import type { Locale } from "../i18n/config";
import { formatUZS } from "./format";

/**
 * "450 000 soʻmdan" in Uzbek, «от 450 000 сум» in Russian. The Uzbek ending and the Russian word before the number are
 * kept here, with the money formats, and not as a translation key: a key that is only a placeholder and "dan" would match
 * any server sentence that ends in "dan" (src/i18n/rendered.ts).
 */
export const formatPriceFrom = (n: number, locale: Locale = "uz"): string => (locale === "ru" ? `от ${formatUZS(n, "ru")}` : `${formatUZS(n)}dan`);
