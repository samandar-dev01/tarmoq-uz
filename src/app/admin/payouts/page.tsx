import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth";
import { formatMoment, formatUZS } from "@/lib/format";
import { formatCardNumber } from "@/lib/cardFormat";
import { decryptCard } from "@/lib/payoutSecret";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card, tagClasses } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarkPayoutPaid } from "@/components/admin/AdminActions";

export const metadata = { title: "Admin: ijodkorlarga toʻlov" };

/** The full card number is decrypted here, on this admin-only page, and nowhere else. */
function readCard(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null;
  try {
    return formatCardNumber(decryptCard(encrypted));
  } catch {
    return null;
  }
}

export default async function AdminPayouts() {
  await requirePageRole("ADMIN");
  const payouts = await prisma.payout.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "asc" }], // waiting first, the oldest first
    take: 200,
    include: {
      provider: { select: { name: true, email: true, providerProfile: { select: { payoutHolder: true, payoutCardEnc: true } } } },
      payment: { select: { order: { select: { id: true, service: { select: { title: true } } } } } },
    },
  });

  return (
    <>
      <h1>Ijodkorlarga toʻlov</h1>
      <div className="mt-6 space-y-4">
        {payouts.length === 0 ? (
          <EmptyState title="Hozircha ijodkorlarga oʻtkaziladigan pul yoʻq" description="Mijoz ishni qabul qilgach, ijodkorning ulushi shu yerda paydo boʻladi." />
        ) : (
          payouts.map((p) => {
            const pending = p.status === "PENDING";
            const profile = p.provider.providerProfile;
            const card = pending ? readCard(profile?.payoutCardEnc) : null;
            return (
              <Card key={p.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <ButtonLink href={`/orders/${p.payment.order.id}`} variant="link" className="font-bold">{p.payment.order.service.title}</ButtonLink>
                    <p className="mt-1 text-ink-soft">Ijodkor: {p.provider.name}.</p>
                    <p className="mt-1 font-bold">{formatUZS(p.amount)}</p>
                  </div>
                  <span className={tagClasses(pending ? "saffron" : "turquoise")}>{pending ? "Kutilmoqda" : "Oʻtkazildi"}</span>
                </div>
                {pending ? (
                  <div className="mt-4 space-y-3">
                    {card ? (
                      <p><span className="text-sm font-semibold text-ink-soft">Karta: </span><span className="font-bold tabular-nums">{card}</span>{profile?.payoutHolder ? `, ${profile.payoutHolder}` : ""}</p>
                    ) : (
                      <Alert variant="warning">Ijodkor hali karta kiritmagan. Kartasini soʻrash uchun u bilan {p.provider.email} orqali bogʻlaning.</Alert>
                    )}
                    <MarkPayoutPaid payoutId={p.id} amount={formatUZS(p.amount)} />
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-ink-soft">{p.paidAt ? `Oʻtkazildi: ${formatMoment(p.paidAt)}` : "Oʻtkazildi"}</p>
                )}
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}
