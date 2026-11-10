import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { getParticipantConversation, markRead } from "@/lib/messaging";
import { HttpError } from "@/lib/errors";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { ChatWindow } from "@/components/chat/ChatWindow";

export const metadata = { title: "Suhbat" };

export default async function ConversationPage({ params }: { params: { conversationId: string } }) {
  const user = await requirePageRole("CLIENT", "PROVIDER");
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

  return (
    <Container size="lg">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <ButtonLink href="/messages" variant="link" className="text-sm">Barcha xabarlar</ButtonLink>
          <h1 className="mt-1">{other.name}</h1>
        </div>
        {conversation.orderId && (
          <ButtonLink href={`/orders/${conversation.orderId}`} variant="secondary" size="sm">Buyurtmani koʻrish</ButtonLink>
        )}
      </div>
      <ChatWindow
        conversationId={conversation.id}
        meId={user.id}
        initialMessages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
      />
    </Container>
  );
}
