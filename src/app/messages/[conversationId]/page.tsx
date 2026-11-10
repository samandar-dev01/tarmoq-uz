import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { getParticipantConversation, markRead } from "@/lib/messaging";
import { HttpError } from "@/lib/errors";
import { ChatWindow } from "@/components/chat/ChatWindow";

export const metadata = { title: "Conversation" };

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
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link href="/messages" className="text-sm text-indigo-600 hover:underline">← All messages</Link>
          <h1 className="text-xl font-bold">{other.name}</h1>
        </div>
        {conversation.orderId && (
          <Link href={`/orders/${conversation.orderId}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">
            View order
          </Link>
        )}
      </div>
      <ChatWindow
        conversationId={conversation.id}
        meId={user.id}
        initialMessages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
      />
    </div>
  );
}
