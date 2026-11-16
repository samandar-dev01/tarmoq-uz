"use client";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useHydrated } from "@/components/ui/useHydrated";
import { useT } from "@/i18n/client";
import { useAction } from "./useAction";

const STAR = "M12 2.5l2.94 6.1 6.56.9-4.8 4.6 1.2 6.6L12 17.6 6.1 20.7l1.2-6.6-4.8-4.6 6.56-.9L12 2.5z";

export function ReviewForm({ orderId }: { orderId: string }) {
  const { run, loading, error, fe } = useAction();
  const t = useT();
  const ready = useHydrated();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const shown = hover || rating;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await run(`/api/orders/${orderId}/review`, { json: { rating: rating || undefined, comment } });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error && <Alert variant="error">{error}</Alert>}
      <div>
        <p id="rating-label" className="mb-1.5 text-sm font-bold">{t("Baho")}</p>
        <div role="radiogroup" aria-labelledby="rating-label" className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n} type="button" role="radio" aria-checked={rating === n} aria-label={t("{n} yulduz", { n })}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              className="rounded-ctl p-1 transition-transform duration-150 hover:scale-110"
            >
              <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true" className={`${n <= shown ? "text-star" : "text-ink-mute/30"} ${rating === n ? "animate-star-pop" : ""}`}>
                <path d={STAR} fill="currentColor" stroke="none" />
              </svg>
            </button>
          ))}
        </div>
        {fe("rating") && <p className="mt-1.5 text-sm font-semibold text-pomegranate-deep">{fe("rating")}</p>}
      </div>
      <Field as="textarea" label={t("Sharhingiz")} id="comment" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} error={fe("comment")} placeholder={t("Ish qanday oʻtdi? Ijodkorni boshqalarga tavsiya qilasizmi?")} />
      <Button type="submit" loading={loading} disabled={!ready}>{loading ? t("Saqlanmoqda…") : t("Sharhni yuborish")}</Button>
    </form>
  );
}
