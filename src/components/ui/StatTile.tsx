import type { ReactNode } from "react";
import { cardClasses, type CardTone } from "./Card";

/** One number with its label. Goes inside the page's <dl>. Use `compact` for long values such as money. */
export function StatTile({ label, value, tone = "white", compact = false }: { label: string; value: ReactNode; tone?: CardTone; compact?: boolean }) {
  return (
    <div className={cardClasses({ tone, padding: "sm" })}>
      <dt className="text-sm font-semibold text-ink-soft">{label}</dt>
      {/* Numbers use the text face: in the display face a 0 looks like the letter O. */}
      <dd className={`mt-1 font-extrabold tabular-nums tracking-tight ${compact ? "text-xl" : "text-3xl"}`}>{value}</dd>
    </div>
  );
}
