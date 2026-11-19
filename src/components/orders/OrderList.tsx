import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { getLocale, getT } from "@/i18n/server";
import { formatDay, formatUZS } from "@/lib/format";
import { cardClasses } from "@/components/ui/Card";
import { StatusBadge } from "./StatusBadge";

export type OrderRow = { id: string; status: OrderStatus; title: string; other: string; price: number | null; updatedAt: Date; action: string };

export async function OrderList({ rows }: { rows: OrderRow[] }) {
  const t = await getT();
  const locale = await getLocale();
  return (
    <ul className={cardClasses({ padding: "none", className: "divide-y divide-line overflow-hidden" })}>
      {rows.map((o) => (
        <li key={o.id}>
          <Link href={`/orders/${o.id}`} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-saffron-tint sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p data-user-content className="truncate font-bold">{o.title}</p>
              <p className="truncate text-sm text-ink-soft">{t("{name} bilan", { name: o.other })}</p>
              <p className="mt-1.5 text-sm font-semibold text-cobalt-dark">{o.action}</p>
            </div>
            <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
              <StatusBadge status={o.status} locale={locale} />
              <span className="font-bold">{o.price ? formatUZS(o.price, locale) : "—"}</span>
              <span className="hidden text-xs text-ink-mute sm:block">{t("Yangilangan: {date}", { date: formatDay(o.updatedAt, locale) })}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
