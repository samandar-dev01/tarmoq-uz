import type { ReactNode } from "react";

/** An empty screen is an invitation: say what belongs here, and offer the next step. */
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border-2 border-dashed border-ink bg-white px-6 py-12 text-center">
      {/* The Tarmoq mark with its last node still empty. */}
      <svg className="mx-auto h-14 w-14" viewBox="0 0 56 56" fill="none" aria-hidden="true">
        <path d="M12 18h32M28 18v24" stroke="rgb(var(--c-ink))" strokeWidth="3" strokeLinecap="round" />
        <circle cx="12" cy="18" r="5.5" fill="rgb(var(--c-saffron))" stroke="rgb(var(--c-ink))" strokeWidth="2.5" />
        <circle cx="44" cy="18" r="5.5" fill="rgb(var(--c-saffron))" stroke="rgb(var(--c-ink))" strokeWidth="2.5" />
        <circle cx="28" cy="43" r="5.5" fill="white" stroke="rgb(var(--c-ink))" strokeWidth="2.5" strokeDasharray="3.5 3.5" />
      </svg>
      <h3 className="mt-4 text-lg">{title}</h3>
      {description && <p className="mx-auto mt-1.5 max-w-md text-ink-soft">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
