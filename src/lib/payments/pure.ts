// Pure sandbox rules (no I/O) so they can be unit-tested. The SERVER decides every payment outcome.

export type CardInput = { number: string; expMonth: number; expYear: number; cvc: string };

export type CardResult =
  | { outcome: "success"; brand: string; last4: string }
  | { outcome: "declined"; brand: string; last4: string; failureCode: "card_declined" | "insufficient_funds"; message: string }
  | { outcome: "invalid"; message: string };

const SUCCESS = new Set(["4242424242424242", "5555555555554444"]);
const DECLINED: Record<string, { code: "card_declined" | "insufficient_funds"; message: string }> = {
  "4000000000000002": { code: "card_declined", message: "Karta rad etildi." },
  "4000000000009995": { code: "insufficient_funds", message: "Kartada mablagʻ yetarli emas." },
};

const invalid = (message: string): CardResult => ({ outcome: "invalid", message });

export function evaluateTestCard(input: CardInput, now: Date = new Date()): CardResult {
  const digits = input.number.replace(/[\s-]/g, "");
  if (!/^\d{13,19}$/.test(digits)) return invalid("Karta raqamini toʻgʻri kiriting.");
  if (!Number.isInteger(input.expMonth) || input.expMonth < 1 || input.expMonth > 12) {
    return invalid("Amal qilish oyini toʻgʻri kiriting (01–12).");
  }
  const year = input.expYear < 100 ? 2000 + input.expYear : input.expYear;
  if (!Number.isInteger(year)) return invalid("Amal qilish yilini toʻgʻri kiriting.");
  const endOfExpiryMonth = new Date(year, input.expMonth, 0, 23, 59, 59);
  if (endOfExpiryMonth < now) return invalid("Kartaning amal qilish muddati tugagan.");
  if (!/^\d{3,4}$/.test(input.cvc)) return invalid("3 xonali xavfsizlik kodini kiriting.");

  const brand = digits.startsWith("4") ? "visa" : digits.startsWith("5") ? "mastercard" : "unknown";
  const last4 = digits.slice(-4);
  if (SUCCESS.has(digits)) return { outcome: "success", brand, last4 };
  const declined = DECLINED[digits];
  if (declined) return { outcome: "declined", brand, last4, failureCode: declined.code, message: declined.message };
  return invalid("Sinov rejimi: 4242 4242 4242 4242 kabi test kartasidan foydalaning.");
}

export function computeFees(amount: number, percent: number): { fee: number; payout: number } {
  const fee = Math.floor((amount * percent) / 100);
  return { fee, payout: amount - fee };
}
