const STAR = "M12 2.5l2.94 6.1 6.56.9-4.8 4.6 1.2 6.6L12 17.6 6.1 20.7l1.2-6.6-4.8-4.6 6.56-.9L12 2.5z";

/** Read-only rating. Announced as one image with the number, not as five separate stars. */
export function Stars({ value, count, size = 16, className = "" }: { value: number; count?: number; size?: number; className?: string }) {
  const filled = Math.round(Math.max(0, Math.min(5, value)));
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span role="img" aria-label={`Reyting: ${value.toFixed(1)} / 5`} className="inline-flex gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={i < filled ? "text-saffron" : "text-paper-deep"}>
            <path d={STAR} fill="currentColor" stroke="rgb(var(--c-ink))" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        ))}
      </span>
      {count !== undefined && (
        <span className="text-sm font-semibold">
          {value.toFixed(1)} <span className="font-normal text-ink-soft">({count})</span>
        </span>
      )}
    </span>
  );
}
