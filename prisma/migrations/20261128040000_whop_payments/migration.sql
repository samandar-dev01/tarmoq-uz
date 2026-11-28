-- Online card payments through Whop. Additive only: three optional columns and two unique indexes.
ALTER TABLE "Payment" ADD COLUMN "providerRef" TEXT,
ADD COLUMN "providerPaymentId" TEXT,
ADD COLUMN "checkoutUrl" TEXT;

CREATE UNIQUE INDEX "Payment_providerRef_key" ON "Payment"("providerRef");
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");
