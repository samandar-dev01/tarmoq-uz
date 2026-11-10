import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";

/** /messages/new?to=<userId>: finds or creates a general (non-order) conversation, then opens it. */
export default async function NewConversation({ searchParams }: { searchParams: { to?: string } }) {
  const user = await requirePageRole("CLIENT", "PROVIDER");
  const to = searchParams.to;
  if (!to || to === user.id) redirect("/messages");

  const target = await prisma.user.findUnique({ where: { id: to }, include: { providerProfile: { select: { status: true } } } });
  if (!target || !target.isActive) notFound();

  if (user.role === "CLIENT") {
    // Clients may start a chat only with approved providers.
    if (target.role !== "PROVIDER" || target.providerProfile?.status !== "APPROVED") notFound();
  } else {
    // Providers may only write to clients they already share an order with.
    const shared = await prisma.order.findFirst({ where: { providerId: user.id, clientId: to }, select: { id: true } });
    if (!shared) redirect("/forbidden");
  }

  const existing = await prisma.conversation.findFirst({
    where: {
      orderId: null,
      OR: [
        { userAId: user.id, userBId: to },
        { userAId: to, userBId: user.id },
      ],
    },
    select: { id: true },
  });
  const id = existing?.id ?? (await prisma.conversation.create({ data: { userAId: user.id, userBId: to }, select: { id: true } })).id;
  redirect(`/messages/${id}`);
}
