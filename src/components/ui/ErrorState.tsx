"use client";
import { Button } from "./Button";

export function ErrorState({ message = "Nimadir xato ketdi.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-card border-2 border-ink bg-pomegranate-tint px-6 py-10 text-center">
      <p className="mx-auto max-w-md font-semibold">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          Qayta urinish
        </Button>
      )}
    </div>
  );
}
