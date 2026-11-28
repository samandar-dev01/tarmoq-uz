-- Additive only: a package's subdirection, the creator's questions and answers about it, the questions a client
-- answers when ordering it, and the answers kept with the order.
ALTER TABLE "Service" ADD COLUMN "subcategory" TEXT,
ADD COLUMN "questions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "faq" JSONB;

ALTER TABLE "Order" ADD COLUMN "answers" JSONB;

CREATE INDEX "Service_subcategory_idx" ON "Service"("subcategory");
