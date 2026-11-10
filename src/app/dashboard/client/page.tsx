import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { nextAction } from "@/lib/orderUi";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrderList } from "@/components/orders/OrderList";

export const metadata = { title: "Client dashboard" };

export default async function ClientDashboard() {
  const user = await requirePageRole("CLIENT");
  const orders = await prisma.order.findMany({
    where: { clientId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { service: { select: { title: true } }, provider: { select: { name: true } }, review: { select: { id: true } } },
  });

  const active = orders.filter((o) => !["COMPLETED", "CANCELLED"].includes(o.status)).length;
  const needsAction = orders.filter((o) => ["AGREEMENT_PENDING", "AWAITING_PAYMENT", "DELIVERED"].includes(o.status) || (o.status === "COMPLETED" && !o.review)).length;
  const completed = orders.filter((o) => o.status === "COMPLETED").length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Welcome, {user.name.split(" ")[0]}</h1>
        <Link href="/search" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">Find creators</Link>
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        {[["Active orders", active], ["Need your action", needsAction], ["Completed", completed]].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-slate-200 bg-white p-4">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="mt-1 text-2xl font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Your orders</h2>
      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Search for a creator, pick a package, and send your first order request."
          action={<Link href="/search?city=Andijan" className="text-sm font-medium text-indigo-600 hover:underline">Browse Andijan creators</Link>}
        />
      ) : (
        <OrderList
          rows={orders.map((o) => ({
            id: o.id, status: o.status, title: o.service.title, other: o.provider.name,
            price: o.agreedPrice, updatedAt: o.updatedAt, action: nextAction(o.status, "client", !!o.review),
          }))}
        />
      )}
    </div>
  );
}
