import { requirePageRole } from "@/lib/auth";
import { getAdminStats } from "@/lib/adminStats";
import { formatUZS } from "@/lib/format";
import { StatTile } from "@/components/ui/StatTile";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  await requirePageRole("ADMIN");
  const s = await getAdminStats();
  const cards: { label: string; value: string; tone?: "saffron" | "turquoise" | "pomegranate"; compact?: boolean }[] = [
    { label: "Mijozlar", value: String(s.users.CLIENT ?? 0) },
    { label: "Ijodkorlar", value: String(s.users.PROVIDER ?? 0) },
    { label: "Tasdiq kutayotgan profillar", value: String(s.providerProfiles.PENDING_REVIEW ?? 0), tone: "saffron" },
    { label: "Faol profillar", value: String(s.providerProfiles.APPROVED ?? 0) },
    { label: "Nizoli buyurtmalar", value: String(s.orders.DISPUTED ?? 0), tone: "pomegranate" },
    { label: "Yakunlangan buyurtmalar", value: String(s.orders.COMPLETED ?? 0), tone: "turquoise" },
    { label: "Ushlab turilgan mablagʻ", value: formatUZS(s.escrowHeld), compact: true },
    { label: "Oʻtkazilgan mablagʻ (yalpi)", value: formatUZS(s.paidOutGross), compact: true },
    { label: "Platforma komissiyasi", value: formatUZS(s.platformFees), tone: "turquoise", compact: true },
    { label: "Sharhlar", value: String(s.reviews) },
  ];
  return (
    <>
      <h1>Admin: umumiy koʻrinish</h1>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <StatTile key={c.label} label={c.label} value={c.value} tone={c.tone} compact={c.compact} />
        ))}
      </dl>
    </>
  );
}
