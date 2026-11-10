"use client";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { useAction } from "./useAction";

export function ReviewForm({ orderId }: { orderId: string }) {
  const { run, loading, error, fe } = useAction();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await run(`/api/orders/${orderId}/review`, { json: { rating: rating || undefined, comment } });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert variant="error">{error}</Alert>}
      <div>
        <p id="rating-label" className="mb-1 text-sm font-medium text-slate-700">Rating</p>
        <div role="radiogroup" aria-labelledby="rating-label" className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
              onClick={() => setRating(n)}
              className={`text-3xl leading-none ${n <= rating ? "text-amber-500" : "text-slate-300"}`}
            >
              ★
            </button>
          ))}
        </div>
        {fe("rating") && <p className="mt-1 text-xs text-red-600">{fe("rating")}</p>}
      </div>
      <div>
        <label htmlFor="comment" className="mb-1 block text-sm font-medium text-slate-700">Your review</label>
        <textarea
          id="comment" rows={4} value={comment} onChange={(e) => setComment(e.target.value)}
          className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${fe("comment") ? "border-red-500" : "border-slate-300"}`}
        />
        {fe("comment") && <p className="mt-1 text-xs text-red-600">{fe("comment")}</p>}
      </div>
      <Button type="submit" loading={loading}>{loading ? "Saving…" : "Submit review"}</Button>
    </form>
  );
}
