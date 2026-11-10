import type { OrderStatus } from "@prisma/client";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  REQUESTED: "Requested",
  AGREEMENT_PENDING: "Agreement pending",
  AWAITING_PAYMENT: "Awaiting payment",
  IN_PROGRESS: "In progress",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  DISPUTED: "In dispute",
};

export const STATUS_STYLE: Record<OrderStatus, string> = {
  REQUESTED: "bg-slate-100 text-slate-700",
  AGREEMENT_PENDING: "bg-amber-100 text-amber-800",
  AWAITING_PAYMENT: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  DELIVERED: "bg-indigo-100 text-indigo-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-slate-200 text-slate-600",
  DISPUTED: "bg-red-100 text-red-800",
};

export function nextAction(status: OrderStatus, role: "client" | "provider", hasReview = true): string {
  const client: Record<OrderStatus, string> = {
    REQUESTED: "Waiting for the provider to send terms",
    AGREEMENT_PENDING: "Review and accept the terms",
    AWAITING_PAYMENT: "Pay to start the work",
    IN_PROGRESS: "The provider is working on your video",
    DELIVERED: "Review the delivery and approve it",
    COMPLETED: hasReview ? "Completed" : "Leave a review",
    CANCELLED: "Cancelled",
    DISPUTED: "An administrator is reviewing the dispute",
  };
  const provider: Record<OrderStatus, string> = {
    REQUESTED: "Send your terms",
    AGREEMENT_PENDING: "Waiting for the client to accept",
    AWAITING_PAYMENT: "Waiting for the client’s payment",
    IN_PROGRESS: "Upload the finished video",
    DELIVERED: "Waiting for the client’s approval",
    COMPLETED: "Completed and paid out",
    CANCELLED: "Cancelled",
    DISPUTED: "An administrator is reviewing the dispute",
  };
  return (role === "client" ? client : provider)[status];
}
