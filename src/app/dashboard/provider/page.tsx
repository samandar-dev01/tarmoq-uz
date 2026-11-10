import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { formatUZS } from "@/lib/format";
import { nextAction } from "@/lib/orderUi";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrderList } from "@/components/orders/OrderList";

export const metadata = { title: "Provider dashboard" };

export default async function ProviderDashboard() {
  const user = await requirePageRole("PROVIDER");
  const [profile, orders, earned, held] = await Promise.all([
    prisma.providerProfile.findUnique({ where: { userId: user.id }, select: { slug: true, status: true, ratingAvg: true, ratingCount: true } }),
    prisma.order.findMany({
      where: { providerId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { service: { select: { title: true } }, client: { select: { name: true } } },
    }),
    prisma.ledgerEntry.aggregate({ where: { type: "PROVIDER_PAYOUT", payment: { order: { providerId: user.id } } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "HELD", order: { providerId: user.id } }, _sum: { amount: true } }),
  ]);

  const requests = orders.filter((o) => o.status === "REQUESTED").length;
  const inProgress = orders.filter((o) => o.status === "IN_PROGRESS").length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">Provider dashboard</h1>

      <div className="mt-4">
        {!profile || profile.status === "DRAFT" ? (
          <Alert variant="info">
            Your profile isn’t submitted yet. <Link href="/dashboard/provider/profile/wizard" className="font-medium underline">Complete your profile</Link> to start receiving orders.
          </Alert>
        ) : profile.status === "PENDING_REVIEW" ? (
          <Alert variant="info">Your profile is waiting for admin approval. You’ll appear in search once approved.</Alert>
        ) : profile.status === "SUSPENDED" ? (
          <Alert variant="error">Your profile is suspended. Please contact support.</Alert>
        ) : (
          <Alert variant="success">
            Your profile is live. <Link href={`/providers/${profile.slug}`} className="font-medium underline">View public profile</Link> ·{" "}
            <Link href="/dashboard/provider/profile/wizard" className="font-medium underline">Edit</Link>
          </Alert>
        )}
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["New requests", String(requests)],
          ["In progress", String(inProgress)],
          ["Held in escrow", formatUZS(held._sum.amount ?? 0)],
          ["Paid out (net of fees)", formatUZS(earned._sum.amount ?? 0)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="mt-1 text-xl font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Orders</h2>
      {orders.length === 0 ? (
        <EmptyState title="No orders yet" description="When a client orders one of your packages, it will show up here." />
      ) : (
        <OrderList
          rows={orders.map((o) => ({
            id: o.id, status: o.status, title: o.service.title, other: o.client.name,
            price: o.agreedPrice, updatedAt: o.updatedAt, action: nextAction(o.status, "provider"),
          }))}
        />
      )}
    </div>
  );
}
