import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { formatDate, formatMoment, formatUZS } from "@/lib/format";
import { nextAction } from "@/lib/orderUi";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Stars } from "@/components/ui/Stars";
import { StatusBadge } from "@/components/orders/StatusBadge";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { ReviewForm } from "@/components/orders/ReviewForm";
import { AcceptAgreement, CancelOrder, ClientDecision, DeliveryUpload, OpenDispute, ProposeTerms } from "@/components/orders/OrderPanels";

export const metadata = { title: "Buyurtma" };

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
    <Container size="lg" className="space-y-6">
      {searchParams.paid === "1" && <Alert variant="success">Toʻlov tasdiqlandi (sinov rejimi). Endi ijodkor ishni boshlashi mumkin.</Alert>}

      <Card padding="lg" radius="hero">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[clamp(1.5rem,1.2rem+1.2vw,2rem)]">{order.service.title}</h1>
            <p className="mt-2 text-ink-soft">
              {isAdmin ? `Mijoz: ${order.client.name}. Ijodkor: ${order.provider.name}.` : `${other} bilan`}
            </p>
            <p className="mt-1 text-lg font-bold">{order.agreedPrice ? formatUZS(order.agreedPrice) : "—"}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={order.status} />
            {order.conversation && !isAdmin && (
              <ButtonLink href={`/messages/${order.conversation.id}`} variant="secondary" size="sm">Xabarlar</ButtonLink>
            )}
          </div>
        </div>
        <div className="mt-6"><OrderTimeline status={order.status} /></div>
        {!isAdmin && (
          <Card tone="saffron" padding="sm" className="mt-6">
            <p className="font-bold">Keyingi qadam: {nextAction(order.status, role, !!order.review)}</p>
          </Card>
        )}
      </Card>

      <Card as="section">
        <h2>Buyurtma tavsifi</h2>
        <p className="mt-3 whitespace-pre-line text-ink-soft">{order.brief}</p>
        {order.eventDate && <p className="mt-3 text-sm font-semibold">Sana: {formatDate(order.eventDate)}</p>}
      </Card>

      {isProvider && (order.status === "REQUESTED" || order.status === "AGREEMENT_PENDING") && (
        <Card as="section">
          <h2>{order.status === "REQUESTED" ? "Shartlaringizni yuboring" : "Shartlarni yangilash"}</h2>
          <p className="mb-5 mt-2 text-ink-soft">
            Yuborganingizda siz shartlarni qabul qilgan hisoblanasiz. Soʻng mijoz toʻlovdan oldin aynan shu shartlarni qabul qilishi kerak.
          </p>
          <ProposeTerms
            orderId={order.id}
            update={order.status === "AGREEMENT_PENDING"}
            defaults={{ price: order.agreedPrice ?? order.service.price, days: order.agreedDays ?? order.service.deliveryDays, revisions: order.revisionsAllowed }}
          />
        </Card>
      )}

      {agreement && (
        <Card as="section">
          <h2>Kelishuv ({agreement.version}-versiya)</h2>
          <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-ctl border-2 border-ink bg-paper p-4 font-sans text-sm leading-6">{agreement.termsText}</pre>
          <ul className="mt-4 space-y-1">
            <li>Ijodkor qabul qildi: {agreement.providerAcceptedAt ? formatMoment(agreement.providerAcceptedAt) : "kutilmoqda"}</li>
            <li>Mijoz qabul qildi: {agreement.clientAcceptedAt ? formatMoment(agreement.clientAcceptedAt) : "kutilmoqda"}</li>
          </ul>
          {isClient && order.status === "AGREEMENT_PENDING" && !agreement.clientAcceptedAt && (
            <div className="mt-5"><AcceptAgreement orderId={order.id} termsHash={agreement.termsHash} /></div>
          )}
        </Card>
      )}

      {isClient && order.status === "AWAITING_PAYMENT" && (
        <Card as="section">
          <h2>Toʻlov</h2>
          <p className="mt-2 text-ink-soft">
            Hozir {order.agreedPrice ? formatUZS(order.agreedPrice) : ""} toʻlang. Pul ushlab turiladi va faqat siz tayyor videoni qabul qilganingizdan keyin ijodkorga oʻtkaziladi.
          </p>
          <ButtonLink href={`/checkout/${order.id}`} size="lg" className="mt-5">Xavfsiz toʻlash (sinov rejimi)</ButtonLink>
        </Card>
      )}

      {isProvider && order.status === "IN_PROGRESS" && (
        <Card as="section">
          <h2>Videoni topshirish</h2>
          {order.revisionsUsed > 0 && (
            <div className="mt-3"><Alert variant="warning">Mijoz tuzatish soʻradi. Tafsilotlar uchun xabarlarni koʻring.</Alert></div>
          )}
          <div className="mt-5"><DeliveryUpload orderId={order.id} /></div>
        </Card>
      )}

      {order.deliveries.length > 0 && (
        <Card as="section">
          <h2>Topshirilgan ish</h2>
          {latestDelivery && (
            <video controls preload="metadata" className="mt-4 w-full rounded-ctl border-2 border-ink bg-black" src={`/api/orders/${order.id}/delivery/${latestDelivery.id}`} />
          )}
          <ul className="mt-4 space-y-3">
            {order.deliveries.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{d.fileName}</span>
                  <span className="block text-sm text-ink-soft">
                    {(d.fileSize / 1024 / 1024).toFixed(1)} MB, {formatMoment(d.createdAt)}
                    {d.note ? `. ${d.note}` : ""}
                  </span>
                </span>
                <ButtonLink href={`/api/orders/${order.id}/delivery/${d.id}?download=1`} variant="link" className="shrink-0">Yuklab olish</ButtonLink>
              </li>
            ))}
          </ul>
          {isClient && order.status === "DELIVERED" && (
            <div className="mt-6 border-t-2 border-dashed border-ink/25 pt-6"><ClientDecision orderId={order.id} revisionsLeft={revisionsLeft} /></div>
          )}
        </Card>
      )}

      {order.status === "COMPLETED" && isClient && !order.review && (
        <Card as="section">
          <h2>Sharh qoldiring</h2>
          <div className="mt-4"><ReviewForm orderId={order.id} /></div>
        </Card>
      )}
      {order.review && (
        <Card as="section">
          <h2>Sharh</h2>
          <div className="mt-3"><Stars value={order.review.rating} size={22} /></div>
          <p className="mt-2 text-ink-soft">{order.review.comment}</p>
          {order.review.isHidden && <p className="mt-2 text-sm text-ink-mute">Administrator tomonidan yashirilgan.</p>}
        </Card>
      )}

      {paid && (
        <Card as="section">
          <h2>Tranzaksiya</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-sm font-semibold text-ink-soft">Summa</dt><dd className="font-bold">{formatUZS(paid.amount)}</dd></div>
            <div>
              <dt className="text-sm font-semibold text-ink-soft">Holati</dt>
              <dd className="font-bold">{paid.status === "HELD" ? "Qabul qilinguncha ushlab turilibdi" : paid.status === "RELEASED" ? "Ijodkorga oʻtkazildi" : "Mijozga qaytarildi"}</dd>
            </div>
            <div><dt className="text-sm font-semibold text-ink-soft">Toʻlov usuli</dt><dd>Sinov kartasi {paid.cardBrand ? `${paid.cardBrand} ` : ""}•••• {paid.cardLast4 ?? ""}</dd></div>
            <div><dt className="text-sm font-semibold text-ink-soft">Toʻlov ID</dt><dd className="break-all font-mono text-xs">{paid.id}</dd></div>
            {(isProvider || isAdmin) && payout && fee && (
              <>
                <div><dt className="text-sm font-semibold text-ink-soft">Platforma komissiyasi</dt><dd>{formatUZS(fee.amount)}</dd></div>
                <div><dt className="text-sm font-semibold text-ink-soft">Ijodkor daromadi</dt><dd>{formatUZS(payout.amount)}</dd></div>
              </>
            )}
          </dl>
          <p className="mt-4 text-sm text-ink-soft">Sinov toʻlovi: haqiqiy pul yechilmadi.</p>
        </Card>
      )}

      {!isAdmin && (cancellable || disputable) && (
        <Card as="section" tone="tint">
          <h2 className="font-sans text-lg tracking-normal">Buyurtmani toʻxtatmoqchimisiz?</h2>
          <div className="mt-4 flex flex-wrap items-start gap-4">
            {cancellable && <CancelOrder orderId={order.id} label={isProvider && order.status === "REQUESTED" ? "Soʻrovni rad etish" : "Buyurtmani bekor qilish"} />}
            {disputable && <OpenDispute orderId={order.id} />}
          </div>
        </Card>
      )}
      {order.status === "DISPUTED" && <Alert variant="info">Bu buyurtma nizoda. Administrator toʻlovni ijodkorga oʻtkazish yoki mijozga qaytarishni hal qiladi.</Alert>}
      {order.status === "CANCELLED" && <Alert variant="info">Bu buyurtma bekor qilingan. Hech qanday toʻlov ushlab turilmaydi.</Alert>}
    </Container>
  );
}
