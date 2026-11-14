/**
 * True while payments are the internal sandbox (no real money moves). It is the default: only an explicit
 * PAYMENT_PROVIDER naming a real gateway turns it off. Two things hang on it:
 *   - the sandbox payment endpoints (test cards) answer only while it is true;
 *   - every public promise about held payments carries a visible "Sinov rejimi" badge while it is true.
 */
export const paymentsAreTest = (): boolean => (process.env.PAYMENT_PROVIDER ?? "sandbox") === "sandbox";

/**
 * True when clients pay by sending money to the owner's own card and an admin confirms it by hand
 * (PAYMENT_PROVIDER=manual). The money is real, so `paymentsAreTest()` is false and the test cards stay off.
 */
export const manualPaymentsOn = (): boolean => process.env.PAYMENT_PROVIDER === "manual";
