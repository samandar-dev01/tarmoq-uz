import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { formatUZS } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export const metadata = { title: "Checkout (sandbox)" };

export default async function CheckoutPage({ params }: { params: { orderId: string } }) {
  const user = await requirePageRole("CLIENT");
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { service: { select: { title: true } }, provider: { select: { name: true } } },
  });
  if (!order || order.clientId !== user.id) notFound();
  if (["IN_PROGRESS", "DELIVERED", "COMPLETED"].includes(order.status)) redirect(`/orders/${order.id}`);

  if (order.status !== "AWAITING_PAYMENT") {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <EmptyState
          title="This order isn’t ready for payment"
          description="Payment opens after both you and the provider have accepted the terms."
          action={<Link href={`/orders/${order.id}`} className="text-sm font-medium text-indigo-600 hover:underline">Back to the order</Link>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-2xl font-bold">Checkout</h1>
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <p className="font-medium">{order.service.title}</p>
        <p className="text-slate-600">with {order.provider.name}</p>
        <p className="mt-2 text-lg font-bold">{order.agreedPrice ? formatUZS(order.agreedPrice) : "—"}</p>
        <p className="mt-1 text-xs text-slate-500">Held until you approve the finished video.</p>
      </div>
      <div className="mt-6"><CheckoutForm orderId={order.id} /></div>
    </div>
  );
}
