import type { Prisma } from "@prisma/client";

/**
 * Holds the order's row until the transaction ends, so two changes to one order (accepting terms and replacing them,
 * paying and changing the price, two requests at once) happen one after the other. Call it FIRST in the transaction:
 * what is read after it is then the latest.
 */
export async function lockOrder(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  await tx.$queryRaw`SELECT 1 FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
}
