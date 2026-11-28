import type { OrderStatus, RequestType } from "@prisma/client";

// The resolution centre's rules. Pure. Before payment an order is simply cancelled; once money is held, one side asks
// and the other answers.
export const canAsk = (type: RequestType, status: OrderStatus): boolean =>
  type === "EXTEND" ? status === "IN_PROGRESS" : status === "IN_PROGRESS" || status === "DELIVERED";
