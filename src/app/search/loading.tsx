import { Container } from "@/components/ui/Container";

export default function Loading() {
  return (
    <Container aria-busy="true" aria-label="Ijodkorlar yuklanmoqda">
      <div className="skeleton h-10 w-72 animate-shimmer rounded-ctl" />
      <div className="skeleton mt-6 h-44 animate-shimmer rounded-card border-2 border-ink/10" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-64 animate-shimmer rounded-card border-2 border-ink/10" />
        ))}
      </div>
    </Container>
  );
}
