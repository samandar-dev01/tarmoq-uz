import type { OrderStatus } from "@prisma/client";
import { HttpError } from "./errors";

export type Actor = "client" | "provider" | "admin" | "system";

/** The only place order status transitions are defined. */
const TRANSITIONS: Record<OrderStatus, Partial<Record<OrderStatus, Actor[]>>> = {
  REQUESTED: { AGREEMENT_PENDING: ["provider"], CANCELLED: ["client", "provider"] },
  AGREEMENT_PENDING: { AWAITING_PAYMENT: ["system"], CANCELLED: ["client", "provider"] },
  AWAITING_PAYMENT: { IN_PROGRESS: ["system"], CANCELLED: ["client", "provider"] },
  IN_PROGRESS: { DELIVERED: ["provider"], DISPUTED: ["client", "provider"] },
  DELIVERED: {
    IN_PROGRESS: ["client"], // revision request (limit checked by the route)
    COMPLETED: ["client"],
    DISPUTED: ["client", "provider"],
  },
  DISPUTED: { COMPLETED: ["admin"], CANCELLED: ["admin"] },
  COMPLETED: {},
  CANCELLED: {},
};

export function canTransition(from: OrderStatus, to: OrderStatus, actor: Actor): boolean {
  return TRANSITIONS[from]?.[to]?.includes(actor) ?? false;
}

export function assertTransition(from: OrderStatus, to: OrderStatus, actor: Actor): void {
  if (!canTransition(from, to, actor)) {
    throw new HttpError(409, `This order cannot move from ${from} to ${to} right now.`);
  }
}
