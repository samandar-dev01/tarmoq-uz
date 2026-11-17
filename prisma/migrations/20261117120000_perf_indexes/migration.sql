-- Speed: indexes for columns the app filters and joins on, which had none.
--
-- Additive only: no column, table or row changes, and `IF NOT EXISTS` makes a second run a no-op. The names follow
-- Prisma's own pattern (<Table>_<columns>_idx), so `prisma migrate dev` sees schema.prisma and the database as the same.
-- The tables are small today, so the site will not feel faster at once; this keeps the same pages fast as they grow.

-- A creator's public page, the search price filter and the wizard load a profile's packages and portfolio by profileId.
CREATE INDEX IF NOT EXISTS "Service_profileId_idx" ON "Service"("profileId");
CREATE INDEX IF NOT EXISTS "PortfolioItem_profileId_idx" ON "PortfolioItem"("profileId");

-- Counting a package's orders (profile wizard) and the foreign-key check when a package is deleted.
CREATE INDEX IF NOT EXISTS "Order_serviceId_idx" ON "Order"("serviceId");

-- The order page, the creator dashboard and the admin totals read a payment, its ledger and its deliveries by their order.
-- (constraints.sql already has two PARTIAL unique indexes on Payment.orderId; they only help for those statuses.)
CREATE INDEX IF NOT EXISTS "Payment_orderId_idx" ON "Payment"("orderId");
CREATE INDEX IF NOT EXISTS "LedgerEntry_paymentId_idx" ON "LedgerEntry"("paymentId");
CREATE INDEX IF NOT EXISTS "Delivery_orderId_idx" ON "Delivery"("orderId");

-- "My conversations" looks for a person as either side. The unique index starts with userAId, so it only helps one side.
CREATE INDEX IF NOT EXISTS "Conversation_userBId_idx" ON "Conversation"("userBId");

-- The admin orders page asks for one action on a list of entity ids, without naming the entity.
CREATE INDEX IF NOT EXISTS "AuditLog_action_entityId_idx" ON "AuditLog"("action", "entityId");
