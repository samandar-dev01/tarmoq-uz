-- Database-level rules Prisma cannot express. Safe to run repeatedly.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_rating_range') THEN
    ALTER TABLE "Review" ADD CONSTRAINT review_rating_range CHECK ("rating" BETWEEN 1 AND 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_amount_positive') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT payment_amount_positive CHECK ("amount" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_revisions_valid') THEN
    ALTER TABLE "Order" ADD CONSTRAINT order_revisions_valid CHECK ("revisionsUsed" >= 0 AND "revisionsUsed" <= "revisionsAllowed");
  END IF;
END $$;

-- An order can only ever have one successful (held or released) payment.
CREATE UNIQUE INDEX IF NOT EXISTS payment_one_paid_per_order
  ON "Payment" ("orderId") WHERE status IN ('HELD', 'RELEASED');

-- Manual card transfers: at most one transfer per order can be waiting for an admin at a time.
CREATE UNIQUE INDEX IF NOT EXISTS payment_one_awaiting_per_order
  ON "Payment" ("orderId") WHERE status = 'AWAITING_CONFIRMATION';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_amount_not_negative') THEN
    ALTER TABLE "Payout" ADD CONSTRAINT payout_amount_not_negative CHECK ("amount" >= 0);
  END IF;
END $$;
