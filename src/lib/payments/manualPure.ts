// Pure rules for the manual card-transfer mode (no I/O) so they can be unit-tested.

/**
 * The short code a client writes in the transfer comment so the admin can match the money to the order.
 * It is the last 6 characters of the order id (the random part), upper-cased. It is stateless: nothing is stored,
 * and the admin page also shows the order link, so a rare clash could never confirm the wrong order.
 */
export const orderReference = (orderId: string) => orderId.slice(-6).toUpperCase();

/** `/checkout/<order>?usul=otkazma` opens the card transfer where it is folded under the online payment. */
export const TRANSFER_QUERY = { name: "usul", value: "otkazma" } as const;

export type ManualInstructions = { card: string; holder: string; bank: string | null };

/** Where clients send the money. Null while the card is not configured, so the page can say so instead of guessing. */
export function manualInstructions(env: Record<string, string | undefined> = process.env): ManualInstructions | null {
  const card = env.MANUAL_PAY_CARD?.trim();
  const holder = env.MANUAL_PAY_HOLDER?.trim();
  if (!card || !holder) return null;
  return { card, holder, bank: env.MANUAL_PAY_BANK?.trim() || null };
}
