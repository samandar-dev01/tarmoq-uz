import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { formatUZS } from "@/lib/format";
import { nextAction } from "@/lib/orderUi";
import { Alert } from "@/components/ui/Alert";
import { StatusBadge } from "@/components/orders/StatusBadge";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { ReviewForm } from "@/components/orders/ReviewForm";
import { AcceptAgreement, CancelOrder, ClientDecision, DeliveryUpload, OpenDispute, ProposeTerms } from "@/components/orders/OrderPanels";

export const metadata = { title: "Order" };

const fmt = (d: Date) => `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
const card = "rounded-xl border border-slate-200 bg-white p-5";

export default async function OrderPage({ params, searchParams }: { params: { id: string }; searchParams: { paid?: string } }) {
  const user = await requirePageRole("CLIENT", "PROVIDER", "ADMIN");
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      service: true,
      client: { select: { id: true, name: true } },
      provider: { select: { id: true, name: true } },
      agreements: { orderBy: { version: "desc" }, take: 1 },
      payments: { orderBy: { createdAt: "desc" }, include: { ledger: true } },
      deliveries: { orderBy: { createdAt: "desc" } },
      review: true,
      conversation: { select: { id: true } },
    },
  });
  if (!order) notFound();

  const isClient = order.clientId === user.id;
  const isProvider = order.providerId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!isClient && !isProvider && !isAdmin) notFound(); // never reveal that someone else's order exists

  const agreement = order.agreements[0];
  const paid = order.payments.find((p) => ["HELD", "RELEASED", "REFUNDED"].includes(p.status));
  const payout = paid?.ledger.find((l) => l.type === "PROVIDER_PAYOUT");
  const fee = paid?.ledger.find((l) => l.type === "PLATFORM_FEE");
  const revisionsLeft = order.revisionsAllowed - order.revisionsUsed;
  const cancellable = ["REQUESTED", "AGREEMENT_PENDING", "AWAITING_PAYMENT"].includes(order.status);
  const disputable = ["IN_PROGRESS", "DELIVERED"].includes(order.status);
  const latestDelivery = order.deliveries[0];
  const role = isClient ? "client" : "provider";
  const other = isClient ? order.provider.name : order.client.name;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      {searchParams.paid === "1" && <Alert variant="success">Payment confirmed (sandbox). The provider can now start working.</Alert>}

      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{order.service.title}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {isAdmin ? `${order.client.name} → ${order.provider.name}` : `with ${other}`} · {order.agreedPrice ? formatUZS(order.agreedPrice) : "—"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={order.status} />
            {order.conversation && !isAdmin && (
              <Link href={`/messages/${order.conversation.id}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50">Messages</Link>
            )}
          </div>
        </div>
        <div className="mt-5"><OrderTimeline status={order.status} /></div>
        {!isAdmin && <p className="mt-4 text-sm font-medium text-indigo-700">Next: {nextAction(order.status, role, !!order.review)}</p>}
      </div>

      <section className={card}>
        <h2 className="font-semibold">Brief</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{order.brief}</p>
        {order.eventDate && <p className="mt-2 text-xs text-slate-500">Date: {order.eventDate.toISOString().slice(0, 10)}</p>}
      </section>

      {isProvider && (order.status === "REQUESTED" || order.status === "AGREEMENT_PENDING") && (
        <section className={card}>
          <h2 className="font-semibold">{order.status === "REQUESTED" ? "Send your terms" : "Update your terms"}</h2>
          <p className="mb-4 mt-1 text-sm text-slate-600">Your acceptance is recorded when you send. The client must then accept the same terms before paying.</p>
          <ProposeTerms
            orderId={order.id}
            update={order.status === "AGREEMENT_PENDING"}
            defaults={{ price: order.agreedPrice ?? order.service.price, days: order.agreedDays ?? order.service.deliveryDays, revisions: order.revisionsAllowed }}
          />
        </section>
      )}

      {agreement && (
        <section className={card}>
          <h2 className="font-semibold">Agreement (version {agreement.version})</h2>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700">{agreement.termsText}</pre>
          <ul className="mt-3 space-y-1 text-sm">
            <li>Provider accepted: {agreement.providerAcceptedAt ? fmt(agreement.providerAcceptedAt) : "pending"}</li>
            <li>Client accepted: {agreement.clientAcceptedAt ? fmt(agreement.clientAcceptedAt) : "pending"}</li>
          </ul>
          {isClient && order.status === "AGREEMENT_PENDING" && !agreement.clientAcceptedAt && (
            <div className="mt-4"><AcceptAgreement orderId={order.id} termsHash={agreement.termsHash} /></div>
          )}
        </section>
      )}

      {isClient && order.status === "AWAITING_PAYMENT" && (
        <section className={card}>
          <h2 className="font-semibold">Payment</h2>
          <p className="mt-1 text-sm text-slate-600">
            Pay {order.agreedPrice ? formatUZS(order.agreedPrice) : ""} now. The money is held and only released to the provider when you approve the finished video.
          </p>
          <Link href={`/checkout/${order.id}`} className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
            Pay securely (sandbox)
          </Link>
        </section>
      )}

      {isProvider && order.status === "IN_PROGRESS" && (
        <section className={card}>
          <h2 className="font-semibold">Deliver the video</h2>
          {order.revisionsUsed > 0 && <p className="mt-1 text-sm text-amber-700">The client requested a revision. Check the Messages for details.</p>}
          <div className="mt-4"><DeliveryUpload orderId={order.id} /></div>
        </section>
      )}

      {order.deliveries.length > 0 && (
        <section className={card}>
          <h2 className="font-semibold">Delivery</h2>
          {latestDelivery && (
            <video controls preload="metadata" className="mt-3 w-full rounded-lg bg-black" src={`/api/orders/${order.id}/delivery/${latestDelivery.id}`} />
          )}
          <ul className="mt-3 space-y-2 text-sm">
            {order.deliveries.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">{d.fileName} · {(d.fileSize / 1024 / 1024).toFixed(1)} MB · {fmt(d.createdAt)}{d.note ? ` · ${d.note}` : ""}</span>
                <a href={`/api/orders/${order.id}/delivery/${d.id}?download=1`} className="shrink-0 font-medium text-indigo-600 hover:underline">Download</a>
              </li>
            ))}
          </ul>
          {isClient && order.status === "DELIVERED" && (
            <div className="mt-5 border-t border-slate-100 pt-5"><ClientDecision orderId={order.id} revisionsLeft={revisionsLeft} /></div>
          )}
        </section>
      )}

      {order.status === "COMPLETED" && isClient && !order.review && (
        <section className={card}>
          <h2 className="font-semibold">Leave a review</h2>
          <div className="mt-4"><ReviewForm orderId={order.id} /></div>
        </section>
      )}
      {order.review && (
        <section className={card}>
          <h2 className="font-semibold">Review</h2>
          <p className="mt-2 text-amber-500" aria-label={`${order.review.rating} out of 5`}>{"★".repeat(order.review.rating)}{"☆".repeat(5 - order.review.rating)}</p>
          <p className="mt-1 text-sm text-slate-700">{order.review.comment}</p>
          {order.review.isHidden && <p className="mt-2 text-xs text-slate-500">Hidden by an administrator.</p>}
        </section>
      )}

      {paid && (
        <section className={card}>
          <h2 className="font-semibold">Transaction</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Amount</dt><dd className="font-medium">{formatUZS(paid.amount)}</dd></div>
            <div><dt className="text-slate-500">Status</dt><dd className="font-medium">{paid.status === "HELD" ? "Held until approval" : paid.status === "RELEASED" ? "Released to provider" : "Refunded"}</dd></div>
            <div><dt className="text-slate-500">Method</dt><dd>Sandbox card {paid.cardBrand ? `${paid.cardBrand} ` : ""}•••• {paid.cardLast4 ?? ""}</dd></div>
            <div><dt className="text-slate-500">Reference</dt><dd className="font-mono text-xs">{paid.id}</dd></div>
            {(isProvider || isAdmin) && payout && fee && (
              <>
                <div><dt className="text-slate-500">Platform fee</dt><dd>{formatUZS(fee.amount)}</dd></div>
                <div><dt className="text-slate-500">Provider payout</dt><dd>{formatUZS(payout.amount)}</dd></div>
              </>
            )}
          </dl>
          <p className="mt-3 text-xs text-slate-500">Sandbox payment: no real money was charged.</p>
        </section>
      )}

      {!isAdmin && (cancellable || disputable) && (
        <section className={card}>
          <h2 className="font-semibold">Need to stop?</h2>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            {cancellable && <CancelOrder orderId={order.id} label={isProvider && order.status === "REQUESTED" ? "Decline request" : "Cancel order"} />}
            {disputable && <OpenDispute orderId={order.id} />}
          </div>
        </section>
      )}
      {order.status === "DISPUTED" && <Alert variant="info">This order is in dispute. An administrator will decide whether to release the payment or refund the client.</Alert>}
      {order.status === "CANCELLED" && <Alert variant="info">This order was cancelled. No payment is held.</Alert>}
    </div>
  );
}
