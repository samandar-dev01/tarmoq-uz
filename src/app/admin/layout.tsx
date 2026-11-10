import Link from "next/link";

const TABS = [["/admin", "Overview"], ["/admin/providers", "Providers"], ["/admin/orders", "Orders"], ["/admin/reviews", "Reviews"]];

// Navigation only. Every admin PAGE and API route re-checks the ADMIN role itself.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav aria-label="Admin" className="mb-6 flex flex-wrap gap-2">
        {TABS.map(([href, label]) => (
          <Link key={href} href={href} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50">{label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
