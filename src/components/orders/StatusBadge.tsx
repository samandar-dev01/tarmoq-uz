import type { OrderStatus } from "@prisma/client";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/orderUi";

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span data-testid="order-status" className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}
