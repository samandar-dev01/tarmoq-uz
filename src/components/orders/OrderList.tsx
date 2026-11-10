import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { formatUZS } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

export type OrderRow = { id: string; status: OrderStatus; title: string; other: string; price: number | null; updatedAt: Date; action: string };

export function OrderList({ rows }: { rows: OrderRow[] }) {
  return (
    <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {rows.map((o) => (
        <li key={o.id}>
          <Link href={`/orders/${o.id}`} className="flex flex-col gap-2 px-4 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{o.title}</p>
              <p className="truncate text-xs text-slate-500">with {o.other} · updated {o.updatedAt.toISOString().slice(0, 10)}</p>
              <p className="mt-1 text-xs text-indigo-700">{o.action}</p>
            </div>
            <div className="flex items-center gap-3 sm:flex-col sm:items-end">
              <StatusBadge status={o.status} />
              <span className="text-sm font-semibold">{o.price ? formatUZS(o.price) : "—"}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
