import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { getLocale, getT } from "@/i18n/server";
import { russianReading } from "@/lib/agreements";
import { formatDate, formatMoment, formatUZS } from "@/lib/format";
import { nextAction } from "@/lib/orderUi";
import { paymentsAreTest } from "@/lib/payments/mode";
import { Alert } from "@/components/ui/Alert";
import { buttonClasses } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Stars } from "@/components/ui/Stars";
import { TestModeBadge } from "@/components/ui/TestModeBadge";
import { StatusBadge } from "@/components/orders/StatusBadge";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { ReviewForm } from "@/components/orders/ReviewForm";
import { AcceptAgreement, CancelOrder, ClientDecision, DeliveryUpload, OpenDispute, ProposeTerms } from "@/components/orders/OrderPanels";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Buyurtma") };
}

export default async function OrderPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ paid?: string }> }) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const user = await requirePageRole("CLIENT", "PROVIDER", "ADMIN");
  const t = await getT();
  const locale = await getLocale();
  const order = await prisma.order.findFirst({
    // Admins may open any order; everyone else only an order they are on.
    where: { id: params.id, ...(user.role === "ADMIN" ? {} : { OR: [{ clientId: user.id }, { providerId: user.id }] }) },
    include: {
      service: true,
      client: { select: { id: true, name: true } },
      provider: { select: { id: true, name: true } },
      agreements: { orderBy: { version: "desc" }, take: 1 },
      payments: { orderBy: { createdAt: "desc" }, include: { ledger: true, payout: true } },
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
  const payoutRow = paid?.payout; // money owed to the creator (real payments only)
  const awaitingConfirmation = order.payments.some((p) => p.status === "AWAITING_CONFIRMATION");
  const revisionsLeft = order.revisionsAllowed - order.revisionsUsed;
  const cancellable = ["REQUESTED", "AGREEMENT_PENDING", "AWAITING_PAYMENT"].includes(order.status);
  const disputable = ["IN_PROGRESS", "DELIVERED"].includes(order.status);
  const latestDelivery = order.deliveries[0];
  const role = isClient ? "client" : "provider";
  const other = isClient ? order.provider.name : order.client.name;
  // For a reader of Russian: the agreement's figures in Russian, shown above the Uzbek text that is the binding one.
  // Null when the stored text is not the template (an older text): then only the Uzbek text is shown.
  const agreementRu = agreement && locale === "ru" ? russianReading(agreement.termsText) : null;

  return (
    <Container size="lg" className="space-y-6">
      {searchParams.paid === "1" && <Alert variant="success">{t("Toʻlov tasdiqlandi (sinov rejimi). Endi ijodkor ishni boshlashi mumkin.")}</Alert>}

      <Card padding="lg" radius="hero">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 data-user-content className="text-[clamp(1.5rem,1.2rem+1.2vw,2rem)]">{order.service.title}</h1>
            <p className="mt-2 text-ink-soft">
              {isAdmin ? t("Mijoz: {client}. Ijodkor: {provider}.", { client: order.client.name, provider: order.provider.name }) : t("{name} bilan", { name: other })}
            </p>
            <p className="mt-1 text-lg font-bold">{order.agreedPrice ? formatUZS(order.agreedPrice, locale) : "—"}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={order.status} locale={locale} />
            {order.conversation && !isAdmin && (
              <ButtonLink href={`/messages/${order.conversation.id}`} variant="secondary" size="sm">{t("Xabarlar")}</ButtonLink>
            )}
          </div>
        </div>
        <div className="mt-6"><OrderTimeline status={order.status} /></div>
        {/* The one thing to do now: the loudest text on the page, still one sentence in one element. */}
        {!isAdmin && (
          <Card tone="saffron" padding="md" className="mt-6">
            <p className="text-lg font-bold sm:text-xl">
              {t("Keyingi qadam:")}{" "}
              {awaitingConfirmation
                ? isClient ? t("Administrator toʻlovni tasdiqlashini kuting") : t("Mijozning toʻlovi tekshirilmoqda")
                : t(nextAction(order.status, role, !!order.review))}
            </p>
          </Card>
        )}
      </Card>

      <Card as="section">
        <h2>{t("Buyurtma tavsifi")}</h2>
        <p data-user-content className="mt-3 whitespace-pre-line text-ink-soft">{order.brief}</p>
        {order.eventDate && <p className="mt-3 text-sm font-semibold">{t("Sana: {date}", { date: formatDate(order.eventDate, locale) })}</p>}
      </Card>

      {isProvider && (order.status === "REQUESTED" || order.status === "AGREEMENT_PENDING") && (
        <Card as="section">
          <h2>{order.status === "REQUESTED" ? t("Shartlaringizni yuboring") : t("Shartlarni yangilash")}</h2>
          <p className="mb-5 mt-2 text-ink-soft">
            {t("Yuborganingizda siz shartlarni qabul qilgan hisoblanasiz. Soʻng mijoz toʻlovdan oldin aynan shu shartlarni qabul qilishi kerak.")}
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
          <h2>{t("Kelishuv ({version}-versiya)", { version: agreement.version })}</h2>
          {agreementRu && (
            <div data-testid="agreement-ru" className="mt-4">
              {/* Information only: never stored, never hashed. The Uzbek text below is what both people accept. */}
              <p className="text-sm font-semibold text-ink-soft">{t("Axborot uchun tarjima. Majburiy kuchga ega boʻlgan matn quyidagi oʻzbekcha matndir.")}</p>
              {/* Shown whole, with no scroll box of its own: the binding Uzbek text below keeps its box, and two boxes to scroll one after the other are hard to read on a phone. */}
              <pre className="mt-2 whitespace-pre-wrap rounded-ctl border border-line bg-paper-deep p-4 font-sans text-sm leading-6">{agreementRu}</pre>
              <p className="mt-5 text-sm font-semibold text-ink-soft">{t("Majburiy matn (oʻzbekcha)")}</p>
            </div>
          )}
          <pre data-testid="agreement-uz" lang="uz" className={`${agreementRu ? "mt-2" : "mt-4"} max-h-72 overflow-auto whitespace-pre-wrap rounded-ctl border border-line-strong bg-paper p-4 font-sans text-sm leading-6`}>{agreement.termsText}</pre>
          <ul className="mt-4 space-y-1">
            <li>{t("Ijodkor qabul qildi: {when}", { when: agreement.providerAcceptedAt ? formatMoment(agreement.providerAcceptedAt, locale) : t("kutilmoqda") })}</li>
            <li>{t("Mijoz qabul qildi: {when}", { when: agreement.clientAcceptedAt ? formatMoment(agreement.clientAcceptedAt, locale) : t("kutilmoqda") })}</li>
          </ul>
          {isClient && order.status === "AGREEMENT_PENDING" && !agreement.clientAcceptedAt && (
            <div className="mt-5"><AcceptAgreement orderId={order.id} termsHash={agreement.termsHash} /></div>
          )}
        </Card>
      )}

      {isClient && order.status === "AWAITING_PAYMENT" && (
        <Card as="section">
          <h2>{t("Toʻlov")}</h2>
          {awaitingConfirmation ? (
            <div className="mt-3"><Alert variant="info"><strong>{t("Toʻlovingiz tekshirilmoqda.")}</strong> {t("Administrator pulni koʻrgach tasdiqlaydi, soʻng ijodkor ishni boshlaydi.")}</Alert></div>
          ) : (
            <>
              <p className="mt-2 text-ink-soft">
                {t("Hozir {price} toʻlang. Pul ushlab turiladi va faqat siz tayyor videoni qabul qilganingizdan keyin ijodkorga oʻtkaziladi.", { price: order.agreedPrice ? formatUZS(order.agreedPrice, locale) : "" })} <TestModeBadge />
              </p>
              <ButtonLink href={`/checkout/${order.id}`} size="lg" className="mt-5">{paymentsAreTest() ? t("Xavfsiz toʻlash (sinov rejimi)") : t("Toʻlash")}</ButtonLink>
            </>
          )}
        </Card>
      )}

      {isProvider && order.status === "IN_PROGRESS" && (
        <Card as="section">
          <h2>{t("Videoni topshirish")}</h2>
          {order.revisionsUsed > 0 && (
            <div className="mt-3"><Alert variant="warning">{t("Mijoz tuzatish soʻradi. Tafsilotlar uchun xabarlarni koʻring.")}</Alert></div>
          )}
          <div className="mt-5"><DeliveryUpload orderId={order.id} /></div>
        </Card>
      )}

      {order.deliveries.length > 0 && (
        <Card as="section">
          <h2>{t("Topshirilgan ish")}</h2>
          {latestDelivery && (
            <video controls preload="metadata" className="mt-4 w-full rounded-ctl border border-line-strong bg-media" src={`/api/orders/${order.id}/delivery/${latestDelivery.id}`} />
          )}
          <ul className="mt-4 space-y-3">
            {order.deliveries.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span data-user-content className="block truncate font-semibold">{d.fileName}</span>
                  <span className="block text-sm text-ink-soft">
                    {t("{size} MB, {when}", { size: (d.fileSize / 1024 / 1024).toFixed(1), when: formatMoment(d.createdAt, locale) })}
                    {d.note ? `. ${d.note}` : ""}
                  </span>
                </span>
                <ButtonLink href={`/api/orders/${order.id}/delivery/${d.id}?download=1`} variant="link" className="shrink-0">{t("Yuklab olish")}</ButtonLink>
              </li>
            ))}
          </ul>
          {isClient && order.status === "DELIVERED" && (
            <div className="mt-6 border-t border-dashed border-line-strong pt-6"><ClientDecision orderId={order.id} revisionsLeft={revisionsLeft} /></div>
          )}
        </Card>
      )}

      {order.status === "COMPLETED" && isClient && !order.review && (
        <Card as="section">
          <h2>{t("Sharh qoldiring")}</h2>
          <div className="mt-4"><ReviewForm orderId={order.id} /></div>
        </Card>
      )}
      {order.review && (
        <Card as="section">
          <h2>{t("Sharh")}</h2>
          <div className="mt-3"><Stars value={order.review.rating} size={22} /></div>
          <p data-user-content className="mt-2 text-ink-soft">{order.review.comment}</p>
          {order.review.isHidden && <p className="mt-2 text-sm text-ink-mute">{t("Administrator tomonidan yashirilgan.")}</p>}
        </Card>
      )}

      {paid && (
        <Card as="section">
          <h2>{t("Tranzaksiya")}</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-sm font-semibold text-ink-soft">{t("Summa")}</dt><dd className="font-bold">{formatUZS(paid.amount, locale)}</dd></div>
            <div>
              <dt className="text-sm font-semibold text-ink-soft">{t("Holati")}</dt>
              <dd className="font-bold">
                {paid.status === "HELD"
                  ? t("Qabul qilinguncha ushlab turilibdi")
                  : paid.status === "RELEASED"
                    ? payoutRow?.status === "PENDING" ? t("Qabul qilindi, ijodkorga oʻtkazish kutilmoqda") : t("Ijodkorga oʻtkazildi")
                    : t("Mijozga qaytarildi")}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-ink-soft">{t("Toʻlov usuli")}</dt>
              <dd>{paid.provider === "manual" ? t("Karta orqali oʻtkazma (administrator tasdiqlagan)") : t("Sinov kartasi {card}", { card: `${paid.cardBrand ? `${paid.cardBrand} ` : ""}•••• ${paid.cardLast4 ?? ""}` })}</dd>
            </div>
            {(isProvider || isAdmin) && payout && fee && (
              <>
                <div><dt className="text-sm font-semibold text-ink-soft">{t("Platforma komissiyasi")}</dt><dd>{formatUZS(fee.amount, locale)}</dd></div>
                <div><dt className="text-sm font-semibold text-ink-soft">{t("Ijodkor daromadi")}</dt><dd>{formatUZS(payout.amount, locale)}</dd></div>
              </>
            )}
            {/* While a payout is pending the status above already says so; this row adds when it was sent. */}
            {(isProvider || isAdmin) && payoutRow?.status === "PAID" && (
              <div>
                <dt className="text-sm font-semibold text-ink-soft">{t("Ijodkorga toʻlov")}</dt>
                <dd className="font-bold">{payoutRow.paidAt ? t("Oʻtkazildi: {when}", { when: formatMoment(payoutRow.paidAt, locale) }) : t("Oʻtkazildi")}</dd>
              </div>
            )}
          </dl>
          {paid.provider === "sandbox" && <p className="mt-4 text-sm text-ink-soft">{t("Sinov toʻlovi: haqiqiy pul yechilmadi.")}</p>}
          {/* The payment's technical id (what support asks for) is one tap away, not in the way. Outside the <dl>: a <details> is not allowed inside one. */}
          <details className="mt-2">
            <summary className={buttonClasses({ variant: "link", className: "inline-flex min-h-11 items-center" })}>{t("Tafsilotlar")}</summary>
            <dl className="mt-2">
              <div><dt className="text-sm font-semibold text-ink-soft">{t("Toʻlov ID")}</dt><dd className="break-all font-mono text-xs">{paid.id}</dd></div>
            </dl>
          </details>
        </Card>
      )}

      {!isAdmin && (cancellable || disputable) && (
        <Card as="section" tone="tint">
          <h2 className="font-sans text-lg tracking-normal">{t("Buyurtmani toʻxtatmoqchimisiz?")}</h2>
          <div className="mt-4 flex flex-wrap items-start gap-4">
            {cancellable && <CancelOrder orderId={order.id} label={isProvider && order.status === "REQUESTED" ? t("Soʻrovni rad etish") : t("Buyurtmani bekor qilish")} />}
            {disputable && <OpenDispute orderId={order.id} />}
          </div>
        </Card>
      )}
      {order.status === "DISPUTED" && <Alert variant="info">{t("Bu buyurtma nizoda. Administrator toʻlovni ijodkorga oʻtkazish yoki mijozga qaytarishni hal qiladi.")}</Alert>}
      {order.status === "CANCELLED" && <Alert variant="info">{t("Bu buyurtma bekor qilingan. Hech qanday toʻlov ushlab turilmaydi.")}</Alert>}
    </Container>
  );
}
