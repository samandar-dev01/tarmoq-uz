export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8" aria-busy="true" aria-label="Loading creators">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 h-40 animate-pulse rounded-xl bg-slate-200" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-xl bg-slate-200" />
        ))}
      </div>
    </div>
  );
}
