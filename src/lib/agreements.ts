import { createHash } from "crypto";
import { PLATFORM_FEE, platformFee } from "./fees";
import { formatUZS } from "./format";

export type TermsInput = {
  orderId: string;
  version: number;
  serviceTitle: string;
  clientName: string;
  providerName: string;
  price: number;
  deliveryDays: number;
  revisions: number;
  notes?: string;
};

/**
 * How many times a creator may send terms for one order: the first offer and two changes. More than that is a sign the two
 * should talk (the chat is for that), and every send puts a message in the client's chat, so it must not go on forever.
 */
export const MAX_TERMS_VERSIONS = 3;

/** How many more times the creator may send changed terms, after version `version` (0 = none left). */
export const termsChangesLeft = (version: number) => Math.max(0, MAX_TERMS_VERSIONS - version);

export function buildTermsText(t: TermsInput): string {
  return [
    `XIZMAT KOʻRSATISH KELISHUVI (${t.version}-versiya)`,
    `1. Tomonlar: Mijoz ${t.clientName} va Ijodkor ${t.providerName}.`,
    `2. Xizmat: ${t.serviceTitle}.`,
    `3. Narxi: ${formatUZS(t.price)}. Toʻlov oldindan amalga oshiriladi va mijoz topshirilgan ishni qabul qilmaguncha platformada ushlab turiladi.`,
    `4. Muddat: toʻlov tasdiqlangandan keyin ${t.deliveryDays} kun ichida topshiriladi.`,
    `5. Tuzatishlar: ${t.revisions} ta tuzatish kiritilgan.`,
    `6. Ish hajmi boʻyicha izoh: ${t.notes?.trim() ? t.notes.trim() : "Yoʻq."}`,
    `7. Qabul qilish va pulni oʻtkazish: mijoz topshirilgan ishni qabul qilganda, ushlab turilgan pul platforma komissiyasi chegirilgan holda ijodkorga oʻtkaziladi.`,
    `8. Bekor qilish: toʻlovdan oldin har ikki tomon hech qanday xarajatsiz bekor qilishi mumkin. Toʻlovdan keyingi muammolar nizo jarayoni orqali hal qilinadi.`,
    `9. Nizolar: ish jarayonda yoki topshirilgan boʻlsa, har ikki tomon nizo ochishi mumkin. Administrator pulni ijodkorga oʻtkazish yoki mijozga qaytarishni hal qiladi.`,
    `10. Platforma komissiyasi: narxning ${PLATFORM_FEE.percent}%, lekin kamida ${formatUZS(PLATFORM_FEE.minimumUZS)}. Komissiya ijodkor oladigan summadan ushlab qolinadi; mijoz faqat kelishilgan narxni toʻlaydi. Bu buyurtmada komissiya ${formatUZS(platformFee(t.price).fee)}, ijodkor oladigan summa ${formatUZS(platformFee(t.price).payout)}.`,
    `11. Videodan foydalanish: mijoz topshirilgan videodan buyurtma tavsifida koʻrsatilgan maqsadda foydalanishi mumkin.`,
  ].join("\n");
}

/** Fingerprint of exactly what both parties accepted. Stored with the acceptance record. */
export function hashTerms(t: Pick<TermsInput, "orderId" | "version" | "price" | "deliveryDays" | "revisions"> & { termsText: string }): string {
  return createHash("sha256")
    .update(JSON.stringify([t.orderId, t.version, t.price, t.deliveryDays, t.revisions, t.termsText]))
    .digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// THE RUSSIAN READING OF AN AGREEMENT (information only)
//
// The stored `Agreement.termsText` is Uzbek, it is what both people accepted and what the hash above fingerprints, and it
// stays the only binding text. A Russian reader is shown, ABOVE it, a Russian rendering of the same eleven clauses filled
// with the very same figures, names and notes. That rendering is never stored and never hashed; the page labels it as an
// informational translation. Nothing below changes `buildTermsText`, so no stored text or hash ever changes.
//
// The rendering is made from the STORED text, not from the order's present values (a creator may rename a package, a
// person may rename themselves, long after the terms were accepted): `readTerms` takes the figures back out of the
// Uzbek text, and `russianReading` shows a Russian text only when building the Uzbek text again from those figures gives
// the stored text byte for byte. Anything else (a text from an older template) is not shown in Russian at all, rather than risk a
// wrong number next to a legal text. The owner should have a lawyer read the Russian wording.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Everything the template is filled with, except the order's own id (which is not written in the text). */
export type TermsFigures = Omit<TermsInput, "orderId">;

const NO_NOTES = "Yoʻq.";

/**
 * The same eleven clauses in Russian, filled with the same values. Pure. Money and the fee are written as in the Uzbek text
 * (the same whole numbers), only the word «сум» and the grouping are Russian.
 */
export function renderAgreementRu(t: TermsFigures): string {
  const fee = platformFee(t.price);
  // «Yoʻq.» is what the Uzbek template writes for no notes: a creator who wrote exactly that meant the same.
  const written = t.notes?.trim();
  const notes = written && written !== NO_NOTES ? written : "Нет.";
  return [
    `СОГЛАШЕНИЕ ОБ ОКАЗАНИИ УСЛУГ (версия ${t.version})`,
    `1. Стороны: заказчик ${t.clientName} и креатор ${t.providerName}.`,
    `2. Услуга: ${t.serviceTitle}.`,
    `3. Цена: ${formatUZS(t.price, "ru")}. Оплата вносится заранее и удерживается на платформе, пока заказчик не примет сданную работу.`,
    `4. Срок: работа сдаётся в течение ${t.deliveryDays} дн. после подтверждения оплаты.`,
    `5. Правки: включено правок: ${t.revisions}.`,
    `6. Пояснение к объёму работы: ${notes}`,
    `7. Приёмка и перевод денег: когда заказчик принимает сданную работу, удержанные деньги переводятся креатору за вычетом комиссии платформы.`,
    `8. Отмена: до оплаты любая из сторон может отменить заказ без каких-либо расходов. Проблемы после оплаты решаются через процедуру спора.`,
    `9. Споры: пока работа выполняется или уже сдана, любая из сторон может открыть спор. Администратор решает, перевести деньги креатору или вернуть заказчику.`,
    `10. Комиссия платформы: ${PLATFORM_FEE.percent}% от цены, но не менее ${formatUZS(PLATFORM_FEE.minimumUZS, "ru")}. Комиссия удерживается из суммы, которую получает креатор; заказчик платит только согласованную цену. В этом заказе комиссия составляет ${formatUZS(fee.fee, "ru")}, креатор получает ${formatUZS(fee.payout, "ru")}.`,
    `11. Использование видео: заказчик может использовать сданное видео для цели, указанной в описании заказа.`,
  ].join("\n");
}

/** The shape of the Uzbek template up to clause 6, with the values as capture groups (clauses 3 and 7 to 11 are checked by the rebuild). */
const STORED_SHAPE = new RegExp(
  "^XIZMAT KOʻRSATISH KELISHUVI \\((\\d+)-versiya\\)\\n" +
    "1\\. Tomonlar: Mijoz (.+) va Ijodkor (.+)\\.\\n" +
    "2\\. Xizmat: (.+)\\.\\n" +
    "3\\. Narxi: (\\d[\\d\\u00a0 ]*)[\\u00a0 ]soʻm\\. .*\\n" +
    "4\\. Muddat: toʻlov tasdiqlangandan keyin (\\d+) kun ichida topshiriladi\\.\\n" +
    "5\\. Tuzatishlar: (\\d+) ta tuzatish kiritilgan\\.\\n" +
    "6\\. Ish hajmi boʻyicha izoh: ([\\s\\S]*?)\\n" +
    "7\\. Qabul qilish va pulni oʻtkazish: ",
);

/** The figures written in a stored Uzbek text, or null when the text does not have the template's shape. */
export function readTerms(termsText: string): TermsFigures | null {
  const m = STORED_SHAPE.exec(termsText);
  if (!m) return null;
  const [, version, clientName, providerName, serviceTitle, price, deliveryDays, revisions, notes] = m;
  return {
    version: Number(version),
    // Greedy: the LAST " va Ijodkor " separates the two names (a name that holds those words is not a real case).
    clientName: clientName!,
    providerName: providerName!,
    serviceTitle: serviceTitle!,
    price: Number(price!.replace(/[\u00a0 ]/g, "")),
    deliveryDays: Number(deliveryDays),
    revisions: Number(revisions),
    notes: notes === NO_NOTES ? undefined : notes,
  };
}

/**
 * The Russian text to show above a stored Uzbek agreement, or null when it cannot be shown safely: the figures are read
 * out of `termsText`, the Uzbek text is built again from them, and only an exact match counts.
 */
export function russianReading(termsText: string): string | null {
  const figures = readTerms(termsText);
  if (!figures) return null;
  return buildTermsText({ orderId: "", ...figures }) === termsText ? renderAgreementRu(figures) : null;
}
