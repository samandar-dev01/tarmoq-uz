"use client";
import { useT } from "@/i18n/client";
import { Button } from "./Button";

/** `message` is shown as given (the caller translates its own); left out, it is the general sentence in the reader's language. */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <div role="alert" className="rounded-card border border-pomegranate/40 bg-pomegranate-tint px-6 py-10 text-center">
      <p className="mx-auto max-w-md font-semibold">{message ?? t("Nimadir xato ketdi.")}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          {t("Qayta urinish")}
        </Button>
      )}
    </div>
  );
}
