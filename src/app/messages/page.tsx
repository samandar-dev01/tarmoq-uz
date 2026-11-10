import Link from "next/link";
import { requirePageRole } from "@/lib/auth";
import { listConversations } from "@/lib/messaging";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { cardClasses } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Xabarlar" };

export default async function MessagesPage() {
  const user = await requirePageRole("CLIENT", "PROVIDER");
  const conversations = await listConversations(user.id);

  return (
    <Container size="lg">
      <h1>Xabarlar</h1>
      <div className="mt-6">
        {conversations.length === 0 ? (
          <EmptyState
            title="Hozircha suhbatlar yoʻq"
            description="Ijodkorga profilidan yozing yoki buyurtma bering. Tafsilotlarni shu yerda muhokama qilasiz."
            action={<ButtonLink href="/search">Ijodkorlarni topish</ButtonLink>}
          />
        ) : (
          <ul className={cardClasses({ padding: "none", className: "divide-y-2 divide-ink/10 overflow-hidden" })}>
            {conversations.map((c) => (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-saffron-tint">
                  <div className="min-w-0">
                    <p className="truncate font-bold">
                      {c.other.name}
                      {c.orderTitle ? <span className="font-normal text-ink-soft">: {c.orderTitle}</span> : null}
                    </p>
                    <p className="truncate text-ink-soft">{c.last ? c.last.body.replace(/\s+/g, " ") : "Hali xabarlar yoʻq"}</p>
                  </div>
                  {c.unread > 0 && (
                    <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded-full border-2 border-ink bg-pomegranate px-2 text-sm font-bold text-white" aria-label={`${c.unread} ta oʻqilmagan`}>
                      {c.unread}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Container>
  );
}
