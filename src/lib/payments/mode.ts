/**
 * True while payments are the internal sandbox (test cards, no real money moves): the sandbox payment endpoints and
 * card form answer only then. No page announces it, so a production server is in the sandbox only when
 * PAYMENT_PROVIDER says "sandbox" in so many words. If that setting goes missing there, payments stay closed, so a
 * test card can never mark a real order as paid. Everywhere else (development, tests) the sandbox is the default.
 */
export const paymentsAreTest = (): boolean =>
  (process.env.PAYMENT_PROVIDER ?? (process.env.NODE_ENV === "production" ? "" : "sandbox")) === "sandbox";

/**
 * True when clients pay by sending money to the owner's own card and an admin confirms it by hand
 * (PAYMENT_PROVIDER=manual). The money is real, so `paymentsAreTest()` is false and the test cards stay off.
 */
export const manualPaymentsOn = (): boolean => process.env.PAYMENT_PROVIDER === "manual";

// Online payment through Whop is switched on by its keys: see `whopOffered` in whopPure.ts.
