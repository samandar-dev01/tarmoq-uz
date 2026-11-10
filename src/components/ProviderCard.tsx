import Link from "next/link";
import { formatUZS, initials } from "@/lib/format";
import type { ProviderCardData } from "@/lib/providers";

export function ProviderCard({ p }: { p: ProviderCardData }) {
  return (
    <Link
      href={`/providers/${p.slug}`}
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-indigo-100 font-semibold text-indigo-700">
          {initials(p.user.name)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{p.user.name}</p>
          <p className="truncate text-xs text-slate-500">
            {p.city}
            {p.district ? `, ${p.district}` : ""} · {p.category.name}
          </p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-slate-700">{p.headline}</p>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
        <span className="text-slate-600">
          {p.ratingCount > 0 ? (
            <>
              <span className="text-amber-500">★</span> {p.ratingAvg.toFixed(1)} ({p.ratingCount})
            </>
          ) : (
            "New"
          )}
        </span>
        <span className="font-semibold">from {formatUZS(p.startingPrice)}</span>
      </div>
    </Link>
  );
}
