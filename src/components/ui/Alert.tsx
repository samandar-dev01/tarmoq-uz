import type { ReactNode } from "react";

const STYLES = {
  error: "bg-pomegranate-tint",
  success: "animate-pop-in bg-turquoise-tint",
  info: "bg-cobalt-tint",
  warning: "bg-saffron-tint",
} as const;
const ICON_COLOR = {
  error: "text-pomegranate-deep",
  success: "text-turquoise-deep",
  info: "text-cobalt-dark",
  warning: "text-ink",
} as const;
const GLYPH = {
  error: "M12 7.5v5.5m0 3.5h.01",
  success: "m7.5 12.5 3 3 6-6.5",
  info: "M12 11v5.5m0-9h.01",
  warning: "M12 7.5v5.5m0 3.5h.01",
} as const;

export function Alert({ variant = "info", children }: { variant?: keyof typeof STYLES; children: ReactNode }) {
  return (
    <div role={variant === "error" ? "alert" : "status"} className={`flex items-start gap-3 rounded-ctl border-2 border-ink px-4 py-3 text-[0.9375rem] font-medium ${STYLES[variant]}`}>
      <svg className={`mt-0.5 h-5 w-5 shrink-0 ${ICON_COLOR[variant]}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" />
        <path d={GLYPH[variant]} />
      </svg>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
