import { prisma } from "./db";
import { CARD_SELECT, listedWhere, SERVICE_SELECT } from "./providers";

/** The creators of the cookie's slugs that are still listed, in the order they were seen. */
export async function recentlySeen(slugs: string[], limit = 8) {
  if (slugs.length === 0) return [];
  const found = await prisma.providerProfile.findMany({ where: { ...listedWhere(), slug: { in: slugs } }, select: CARD_SELECT });
  return slugs.flatMap((slug) => found.filter((p) => p.slug === slug)).slice(0, limit);
}

/**
 * For a signed-in client: well-rated creators in the directions they have ordered or written about, leaving out the
 * ones they already deal with. Empty for a client with no history.
 */
export async function suggestedFor(clientId: string, limit = 8) {
  const [orders, talks] = await Promise.all([
    prisma.order.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 30, select: { providerId: true } }),
    prisma.conversation.findMany({ where: { OR: [{ userAId: clientId }, { userBId: clientId }] }, take: 30, select: { userAId: true, userBId: true } }),
  ]);
  const known = [...new Set([...orders.map((o) => o.providerId), ...talks.map((c) => (c.userAId === clientId ? c.userBId : c.userAId))])];
  if (known.length === 0) return [];
  const categories = await prisma.providerProfile.findMany({ where: { userId: { in: known } }, select: { categoryId: true } });
  if (categories.length === 0) return [];
  return prisma.providerProfile.findMany({
    where: { ...listedWhere(), categoryId: { in: [...new Set(categories.map((c) => c.categoryId))] }, userId: { notIn: known } },
    orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: CARD_SELECT,
  });
}

/** The saved packages that are still offered, in the order they were saved. */
export async function savedServices(ids: string[]) {
  if (ids.length === 0) return [];
  const found = await prisma.service.findMany({ where: { id: { in: ids }, isActive: true, profile: listedWhere() }, select: SERVICE_SELECT });
  return ids.flatMap((id) => found.filter((s) => s.id === id));
}
