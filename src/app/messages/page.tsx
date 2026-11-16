import Link from "next/link";
import { canBrowseCreators, requirePageRole } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { listConversations } from "@/lib/messaging";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { cardClasses } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Xabarlar") };
}

export default async function MessagesPage() {
  const user = await requirePageRole("CLIENT", "PROVIDER");
  const t = await getT();
  const conversations = await listConversations(user.id);

  return (
    <Container size="lg">
      <h1>{t("Xabarlar")}</h1>
      <div className="mt-6">
        {conversations.length === 0 ? (
          <EmptyState
            title={t("Hozircha suhbatlar yoʻq")}
            description={canBrowseCreators(user) ? t("Ijodkorga profilidan yozing yoki buyurtma bering. Tafsilotlarni shu yerda muhokama qilasiz.") : t("Mijoz sizga yozganda yoki buyurtma berganda, suhbat shu yerda paydo boʻladi.")}
            action={canBrowseCreators(user) ? <ButtonLink href="/search">{t("Ijodkorlarni topish")}</ButtonLink> : undefined}
          />
        ) : (
          <ul className={cardClasses({ padding: "none", className: "divide-y divide-line overflow-hidden" })}>
            {conversations.map((c) => (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-saffron-tint">
                  <div className="min-w-0">
                    <p className="truncate font-bold">
                      {c.other.name}
                      {c.orderTitle ? <span data-user-content className="font-normal text-ink-soft">: {c.orderTitle}</span> : null}
                    </p>
                    <p {...(c.last ? { "data-user-content": true } : {})} className="truncate text-ink-soft">{c.last ? c.last.body.replace(/\s+/g, " ") : t("Hali xabarlar yoʻq")}</p>
                  </div>
                  {c.unread > 0 && (
                    <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded-full bg-pomegranate px-2 text-sm font-bold text-on-accent" aria-label={t("{n} ta oʻqilmagan", { n: c.unread })}>
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
