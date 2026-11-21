import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { formatMoment } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/shellNav";
import { needsAnswer } from "@/lib/support";
import { cardClasses, tagClasses } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Admin: yordam" };

export default async function AdminSupport() {
  await requirePageRole("ADMIN");
  const threads = await prisma.supportThread.findMany({
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      user: { select: { name: true, role: true } },
      messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { body: true, fromStaff: true } },
    },
  });

  return (
    <>
      <h1>Yordam</h1>
      <p className="mt-2 text-ink-soft">Foydalanuvchilarning yordam jamoasiga yozgan xabarlari. Yangi xabar kelganda Telegramga xabar keladi (eng koʻpi 10 daqiqada bir marta).</p>
      <div className="mt-6 space-y-4">
        {threads.length === 0 ? (
          <EmptyState title="Hozircha xabarlar yoʻq" description="Kimdir Yordam tugmasi orqali yozganda, suhbat shu yerda paydo boʻladi." />
        ) : (
          threads.map((t) => {
            const last = t.messages[0];
            const waiting = needsAnswer({ lastMessageAt: t.lastMessageAt, staffReadAt: t.staffReadAt, lastFromStaff: last?.fromStaff ?? false });
            return (
              <Link key={t.id} href={`/admin/support/${t.id}`} data-testid="support-thread" className={cardClasses({ tone: waiting ? "saffron" : "white", interactive: true, className: "block" })}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">{t.user.name} <span className="font-medium text-ink-soft">· {ROLE_LABEL[t.user.role]}</span></p>
                  <div className="flex items-center gap-2">
                    {waiting && <span className={tagClasses("saffron")}>Javob kutmoqda</span>}
                    <span className="text-sm text-ink-mute">{formatMoment(t.lastMessageAt)}</span>
                  </div>
                </div>
                {last && (
                  <p data-user-content className="mt-2 line-clamp-2 whitespace-pre-line text-ink-soft">
                    {last.fromStaff ? "Siz: " : ""}{last.body}
                  </p>
                )}
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}
