// The words that must never appear where search engines and AI crawlers read: titles, descriptions, Open Graph, JSON-LD,
// the FAQ, llms.txt, the manifest, the sitemap. Payments run in manual or test mode, so none of these places may promise
// anything about money, in either language.
// Used by tests/unit/seo.test.ts and tests/e2e/language-public.spec.ts (tests/e2e/seo.spec.ts keeps its own copy of the Uzbek list).
//
// The text is normalised first: lower case, "ё" folded to "е", and every Uzbek apostrophe look-alike removed, so every spelling matches.

/** Uzbek (and the two Russian stems the first guard already had). */
export const BANNED_UZ = [/tolov/, /оплат/, /платеж/, /escrow/, /pul himoya/, /kafolat/, /himoyalangan/];

/**
 * Russian, as word stems (a stem catches every ending). One line per idea a reader could take as a promise about money:
 *   paying           оплат(а|ить), оплач(ен), заплат(ить), выплат(а: a creator's payout), платеж/платёж, платит(ь), платн(ый)
 *   escrow           эскроу
 *   guarantee/safety гаранти(я), безопасн(ая), защит(а), защищ(ённый)
 *   holding          хранени(е), хранит(ся), хранят(ся), удерж(ивается). "хран" must start a word: "сохраните" is fine
 *   money itself     деньг(и), денег, денежн(ый), списан(ие), списыва(ется)
 * Deliberately NOT here: "цена" and "сум" (a price is a fact from the database), "заказ", "пакет", "отзыв", "платформа",
 * and "перечислены" (a list is "перечислено", not a transfer: a transfer of money is caught by "деньг" and "оплат").
 */
export const BANNED_RU = [
  /оплат/, /оплач/, /заплат/, /выплат/, /платеж/, /платит/, /платн/,
  /эскроу/, /escrow/,
  /гаранти/, /безопасн/, /защит/, /защищ/,
  /(?<![а-я])хран(ени|ит|ят)/, /удерж/,
  /деньг/, /денег/, /денежн/, /списан/, /списыва/,
];

export const normaliseForGuard = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[ʻʼ'’‘`]/g, "");

/** The patterns of both lists that match `text` (empty when the text is clean). */
export function bannedIn(text: string, lists: RegExp[][] = [BANNED_UZ, BANNED_RU]): string[] {
  const t = normaliseForGuard(text);
  return lists.flat().filter((re) => re.test(t)).map(String);
}
