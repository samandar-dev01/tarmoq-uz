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
