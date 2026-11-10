import type { OrderStatus } from "@prisma/client";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/orderUi";

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span data-testid="order-status" className={`inline-block rounded-full border-2 border-ink px-3 py-1 text-xs font-bold ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
