"use client";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useAction } from "./useAction";

export function NewOrderForm({ serviceId }: { serviceId: string }) {
  const { run, loading, error, fe, router } = useAction();
  const [brief, setBrief] = useState("");
  const [eventDate, setEventDate] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await run("/api/orders", { json: { serviceId, brief, eventDate } }, (data) => router.push(`/orders/${data.order.id}`));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert variant="error">{error}</Alert>}
      <div>
        <label htmlFor="brief" className="mb-1 block text-sm font-medium text-slate-700">Describe what you need</label>
        <textarea
          id="brief" rows={6} value={brief} onChange={(e) => setBrief(e.target.value)}
          placeholder="What is the video for, where and when will you shoot, and any style you like?"
          className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${fe("brief") ? "border-red-500" : "border-slate-300"}`}
        />
        {fe("brief") && <p className="mt-1 text-xs text-red-600">{fe("brief")}</p>}
      </div>
      <Field label="Event or shoot date (optional)" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} error={fe("eventDate")} />
      <p className="text-xs text-slate-500">You won’t be charged yet. The provider will first send you terms to review and accept.</p>
      <Button type="submit" loading={loading} className="w-full sm:w-auto">{loading ? "Sending…" : "Send order request"}</Button>
    </form>
  );
}
