// Pure helpers for card numbers (no Node-only code), so the browser and the server can both use them.

/** Strips spaces and dashes: "8600 1234-5678 9012" -> "8600123456789012". */
export const cleanCardNumber = (input: string) => input.replace(/[\s-]/g, "");

/** A 16-digit card number whose check digit is right (Uzcard, Humo, Visa and Mastercard all pass), so a typo is caught. */
export function isValidCardNumber(digits: string): boolean {
  if (!/^\d{16}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 16; i++) {
    let d = Number(digits[15 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** "8600123456789012" -> "8600 1234 5678 9012" */
export const formatCardNumber = (digits: string) => digits.replace(/(.{4})(?=.)/g, "$1 ");

/** What the creator sees of their saved card. */
export const maskCard = (last4: string) => `•••• •••• •••• ${last4}`;
