import type { OrderStatus } from "@prisma/client";

const STEPS = ["Requested", "Terms agreed", "Paid", "Delivered", "Completed"];
const DONE: Record<OrderStatus, number> = {
  REQUESTED: 1, AGREEMENT_PENDING: 1, AWAITING_PAYMENT: 2, IN_PROGRESS: 3,
  DELIVERED: 4, COMPLETED: 5, DISPUTED: 3, CANCELLED: 1,
};

export function OrderTimeline({ status }: { status: OrderStatus }) {
  const done = DONE[status];
  const stopped = status === "CANCELLED" || status === "DISPUTED";
  return (
    <ol className="grid grid-cols-5 gap-1 text-center text-[11px] sm:text-xs" aria-label="Order progress">
      {STEPS.map((label, i) => {
        const complete = i < done;
        const current = i === done && !stopped && status !== "COMPLETED";
        return (
          <li key={label} aria-current={current ? "step" : undefined}>
            <div className={`mx-auto mb-1 h-2 rounded-full ${complete ? "bg-indigo-600" : current ? "bg-indigo-300" : "bg-slate-200"} ${stopped && !complete ? "bg-slate-200" : ""}`} />
            <span className={complete || current ? "font-medium text-slate-900" : "text-slate-400"}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
