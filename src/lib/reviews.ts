import type { Prisma } from "@prisma/client";

/** Keeps ProviderProfile.ratingAvg/ratingCount in sync with visible reviews. */
export async function recomputeRating(tx: Prisma.TransactionClient, providerUserId: string) {
  const agg = await tx.review.aggregate({
    where: { providerUserId, isHidden: false },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await tx.providerProfile.update({
    where: { userId: providerUserId },
    data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all },
  });
}
