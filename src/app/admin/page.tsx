import { requirePageRole } from "@/lib/auth";
import { getAdminStats } from "@/lib/adminStats";
import { formatUZS } from "@/lib/format";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  await requirePageRole("ADMIN");
  const s = await getAdminStats();
  const cards: [string, string][] = [
    ["Clients", String(s.users.CLIENT ?? 0)],
    ["Providers", String(s.users.PROVIDER ?? 0)],
    ["Profiles awaiting approval", String(s.providerProfiles.PENDING_REVIEW ?? 0)],
    ["Live profiles", String(s.providerProfiles.APPROVED ?? 0)],
    ["Disputed orders", String(s.orders.DISPUTED ?? 0)],
    ["Completed orders", String(s.orders.COMPLETED ?? 0)],
    ["Held in escrow", formatUZS(s.escrowHeld)],
    ["Released (gross)", formatUZS(s.paidOutGross)],
    ["Platform fees", formatUZS(s.platformFees)],
    ["Reviews", String(s.reviews)],
  ];
  return (
    <>
      <h1 className="text-2xl font-bold">Admin overview</h1>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="mt-1 text-xl font-bold">{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
