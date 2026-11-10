import type { OrderStatus } from "@prisma/client";

const STEPS = ["Soʻrov", "Shartlar kelishildi", "Toʻlandi", "Topshirildi", "Yakunlandi"];
const DONE: Record<OrderStatus, number> = {
  REQUESTED: 1, AGREEMENT_PENDING: 1, AWAITING_PAYMENT: 2, IN_PROGRESS: 3,
  DELIVERED: 4, COMPLETED: 5, DISPUTED: 3, CANCELLED: 1,
};

/** An order really is a sequence, so its steps are numbered; finished steps show a tick. */
export function OrderTimeline({ status }: { status: OrderStatus }) {
  const done = DONE[status];
  const stopped = status === "CANCELLED" || status === "DISPUTED";
  return (
    <ol className="grid grid-cols-5 text-center" aria-label="Buyurtma jarayoni">
      {STEPS.map((label, i) => {
        const complete = i < done;
        const current = i === done && !stopped && status !== "COMPLETED";
        return (
          <li key={label} aria-current={current ? "step" : undefined} className="relative flex flex-col items-center gap-2 px-0.5">
            {i > 0 && (
              <span aria-hidden="true" className={`absolute right-1/2 top-4 h-0 w-full -translate-y-px border-t-2 ${complete ? "border-ink" : "border-dashed border-ink/30"}`} />
            )}
            <span
              className={`relative z-10 grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-bold ${
                complete ? "border-ink bg-cobalt text-white" : current ? "border-ink bg-saffron text-ink" : "border-ink/30 bg-white text-ink-mute"
              }`}
            >
              {complete ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span className={`text-[11px] leading-tight sm:text-xs ${complete || current ? "font-bold text-ink" : "text-ink-mute"}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
