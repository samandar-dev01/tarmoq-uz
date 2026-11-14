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

-- SECURITY FIX (vibeguard #1): lock the database to the app alone.
-- On Supabase every table in the `public` schema is also reachable over its public Data API by anyone holding the
-- project's public (anon) key, and Prisma's tables were created with row level security OFF and full rights granted to
-- the `anon` and `authenticated` roles: read, change, delete, even TRUNCATE, for users, payments and messages.
-- This app never uses that API. It connects as `postgres`, which owns the tables and bypasses row level security, so:
--   1. turn row level security on for every table, with no policies (the public roles then see and change nothing);
--   2. take every right away from `anon` and `authenticated`, on tables and sequences, now and for future tables.
-- This file runs on every start, so a table added by a later migration is covered on the next deploy.
-- Each step is wrapped so that a permissions problem on some host logs a warning instead of stopping the site from starting.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not enable row level security on %: %', t.tablename, SQLERRM;
    END;
  END LOOP;
END $$;

DO $$
DECLARE r text;
BEGIN
  -- These roles exist on Supabase only. On a plain Postgres (local development) there is nothing to revoke.
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      BEGIN
        EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
        EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Could not revoke rights from %: %', r, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;
