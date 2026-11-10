import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { formatDay, formatUZS } from "@/lib/format";
import { cardClasses } from "@/components/ui/Card";
import { StatusBadge } from "./StatusBadge";

export type OrderRow = { id: string; status: OrderStatus; title: string; other: string; price: number | null; updatedAt: Date; action: string };

export function OrderList({ rows }: { rows: OrderRow[] }) {
  return (
    <ul className={cardClasses({ padding: "none", className: "divide-y-2 divide-ink/10 overflow-hidden" })}>
      {rows.map((o) => (
        <li key={o.id}>
          <Link href={`/orders/${o.id}`} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-saffron-tint sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-bold">{o.title}</p>
              <p className="truncate text-sm text-ink-soft">{o.other} bilan</p>
              <p className="mt-1.5 text-sm font-semibold text-cobalt-dark">{o.action}</p>
            </div>
            <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
              <StatusBadge status={o.status} />
              <span className="font-bold">{o.price ? formatUZS(o.price) : "—"}</span>
              <span className="hidden text-xs text-ink-mute sm:block">Yangilangan: {formatDay(o.updatedAt)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
