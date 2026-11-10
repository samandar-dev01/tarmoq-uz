import { prisma } from "./db";

export async function getAdminStats() {
  const [users, profiles, orders, held, released, fees, reviews] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.providerProfile.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.payment.aggregate({ where: { status: "HELD" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "RELEASED" }, _sum: { amount: true } }),
    prisma.ledgerEntry.aggregate({ where: { type: "PLATFORM_FEE" }, _sum: { amount: true } }),
    prisma.review.count(),
  ]);
  const toMap = <T extends string>(rows: { _count: { _all: number } }[], key: string) =>
    Object.fromEntries(rows.map((r) => [(r as unknown as Record<string, T>)[key], r._count._all]));
  return {
    users: toMap(users, "role"),
    providerProfiles: toMap(profiles, "status"),
    orders: toMap(orders, "status"),
    escrowHeld: held._sum.amount ?? 0,
    paidOutGross: released._sum.amount ?? 0,
    platformFees: fees._sum.amount ?? 0,
    reviews,
  };
}
