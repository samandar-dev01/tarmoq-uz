/**
 * True while payments are the internal sandbox (no real money moves). It is the default: only an explicit
 * PAYMENT_PROVIDER naming a real gateway turns it off. Two things hang on it:
 *   - the sandbox payment endpoints (test cards) answer only while it is true;
 *   - every public promise about held payments carries a visible "Sinov rejimi" badge while it is true.
 */
export const paymentsAreTest = (): boolean => (process.env.PAYMENT_PROVIDER ?? "sandbox") === "sandbox";
