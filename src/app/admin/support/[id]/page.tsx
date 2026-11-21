import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/shellNav";
import { SupportThread } from "@/components/help/SupportThread";

export const metadata = { title: "Admin: yordam suhbati" };

// The admin pages are in Uzbek only, so the thread gets its texts from here.
const LABELS = {
  empty: "Hali xabarlar yoʻq.",
  field: "Javob",
  placeholder: "Javob yozing…",
  send: "Yuborish",
  notSent: "Javobni yuborib boʻlmadi.",
  offline: "Internet aloqasida muammo. Javob yuborilmadi.",
  reconnecting: "Aloqa muammosi. Qayta uriniladi…",
};

export default async function AdminSupportThread(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  await requirePageRole("ADMIN");
  const thread = await prisma.supportThread.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, role: true } },
      messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 200, select: { id: true, fromStaff: true, body: true, createdAt: true } },
    },
  });
  if (!thread) notFound();
  // Opening the thread means an admin has seen everything in it so far.
  await prisma.supportThread.update({ where: { id: thread.id }, data: { staffReadAt: new Date() } });

  return (
    <>
      <Link href="/admin/support" className="text-sm font-semibold text-cobalt-dark underline underline-offset-4">← Barcha suhbatlar</Link>
      <h1 className="mt-3">{thread.user.name}</h1>
      <p className="mt-1 text-ink-soft">{ROLE_LABEL[thread.user.role]} · {thread.user.email}</p>
      <div className="mt-6 flex h-[70vh] flex-col overflow-hidden rounded-card border border-line bg-surface">
        <SupportThread
          side="staff"
          endpoint={`/api/admin/support/${thread.id}`}
          initialMessages={thread.messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
          labels={LABELS}
        />
      </div>
    </>
  );
}
