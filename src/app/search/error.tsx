"use client";
import { ErrorState } from "@/components/ui/ErrorState";

export default function SearchError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <ErrorState message="We couldn’t load creators right now." onRetry={reset} />
    </div>
  );
}
