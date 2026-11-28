import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { getParticipantConversation, lastSeenByOther, markRead } from "@/lib/messaging";
import { isOnline } from "@/lib/presence";
import { isTyping } from "@/lib/typing";
import { HttpError } from "@/lib/errors";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { OfferActions, OfferForm } from "@/components/offers/OfferPanels";
import { cardClasses } from "@/components/ui/Card";
import { getLocale } from "@/i18n/server";
import { formatUZS } from "@/lib/format";
import { REQUEST_STATUS, revisionsText } from "@/lib/orderUi";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Suhbat") };
}

export default async function ConversationPage(props: { params: Promise<{ conversationId: string }> }) {
  const params = await props.params;
  const user = await requirePageRole("CLIENT", "PROVIDER");
  const t = await getT();
  let other;
  let conversation;
  try {
    ({ other, conversation } = await getParticipantConversation(params.conversationId, user.id));
  } catch (e) {
    if (e instanceof HttpError) notFound();
    throw e;
  }
  const messages = (
    await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      select: { id: true, senderId: true, body: true, createdAt: true },
    })
  ).reverse();
  await markRead(conversation.id, user.id);
  const [them, seenId] = await Promise.all([prisma.user.findUnique({ where: { id: other.id }, select: { lastSeenAt: true } }), lastSeenByOther(conversation.id, user.id)]);
  const [offers, myServices] = await Promise.all([
    prisma.offer.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "desc" }, take: 5, include: { service: { select: { title: true } } } }),
    // A creator may offer their own terms to a client, from their own published packages.
    user.role === "PROVIDER"
      ? prisma.service.findMany({ where: { isActive: true, profile: { userId: user.id, status: "APPROVED" } }, orderBy: { price: "asc" }, select: { id: true, title: true, price: true, deliveryDays: true, revisions: true } })
      : [],
  ]);
  const locale = await getLocale();
  const initialStatus = { online: isOnline(them?.lastSeenAt), lastSeenAt: them?.lastSeenAt?.toISOString() ?? null, typing: isTyping(conversation.id, other.id), seenId };

  return (
    <Container size="lg">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <ButtonLink href="/messages" variant="link" className="text-sm">{t("Barcha xabarlar")}</ButtonLink>
          <h1 className="mt-1">{other.name}</h1>
        </div>
        {conversation.orderId && (
          <ButtonLink href={`/orders/${conversation.orderId}`} variant="secondary" size="sm">{t("Buyurtmani koʻrish")}</ButtonLink>
        )}
      </div>
      {offers.length > 0 && (
        <ul className="mb-4 space-y-3" aria-label={t("Takliflar roʻyxati")}>
          {offers.map((o) => (
            <li key={o.id} className={cardClasses({ padding: "sm", tone: o.status === "PENDING" ? "saffron" : "white" })}>
              <p className="flex flex-wrap justify-between gap-2 font-bold">
                <span data-user-content>{o.service.title}</span>
                <span className="tabular-nums">{formatUZS(o.price, locale)}</span>
              </p>
              <p data-user-content className="mt-1 whitespace-pre-line">{o.description}</p>
              <p className="mt-1 text-sm text-ink-soft">
                {t("{days} kunda topshiriladi", { days: o.deliveryDays })} · {revisionsText(locale, o.revisions)} · {t(REQUEST_STATUS[o.status])}
              </p>
              {o.status === "PENDING" && <OfferActions offerId={o.id} mine={o.providerId === user.id} />}
              {o.orderId && <ButtonLink href={`/orders/${o.orderId}`} variant="link" className="mt-2 inline-flex min-h-11 items-center">{t("Buyurtmani koʻrish")}</ButtonLink>}
            </li>
          ))}
        </ul>
      )}
      {myServices.length > 0 && !conversation.orderId && (
        <details className={cardClasses({ padding: "sm", className: "mb-4" })}>
          <summary className="min-h-11 py-2 font-bold">{t("Maxsus taklif yuborish")}</summary>
          <OfferForm conversationId={conversation.id} services={myServices} />
        </details>
      )}
      <ChatWindow
        conversationId={conversation.id}
        meId={user.id}
        initialStatus={initialStatus}
        initialMessages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
      />
    </Container>
  );
}
