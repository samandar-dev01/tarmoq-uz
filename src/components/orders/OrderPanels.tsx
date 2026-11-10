"use client";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useAction } from "./useAction";

const area = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500";

/** Provider: send (or update) the terms. */
export function ProposeTerms({ orderId, defaults, update }: { orderId: string; defaults: { price: number; days: number; revisions: number }; update: boolean }) {
  const { run, loading, error, fe } = useAction();
  const [price, setPrice] = useState(String(defaults.price));
  const [days, setDays] = useState(String(defaults.days));
  const [revisions, setRevisions] = useState(String(defaults.revisions));
  const [notes, setNotes] = useState("");

  const num = (v: string) => (v === "" ? undefined : Number(v));
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await run(`/api/orders/${orderId}/propose`, { json: { price: num(price), deliveryDays: num(days), revisions: num(revisions), notes: notes || undefined } });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert variant="error">{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Price (UZS)" type="number" inputMode="numeric" min={0} step={10000} value={price} onChange={(e) => setPrice(e.target.value)} error={fe("price")} />
        <Field label="Delivery (days)" type="number" inputMode="numeric" min={1} value={days} onChange={(e) => setDays(e.target.value)} error={fe("deliveryDays")} />
        <Field label="Revisions included" type="number" inputMode="numeric" min={0} value={revisions} onChange={(e) => setRevisions(e.target.value)} error={fe("revisions")} />
      </div>
      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium text-slate-700">Notes (optional)</label>
        <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={area} placeholder="Scope details, locations, what is not included…" />
      </div>
      <Button type="submit" loading={loading}>{update ? "Send updated terms" : "Send terms to client"}</Button>
    </form>
  );
}

/** Client: accept the exact terms version shown (identified by its hash). */
export function AcceptAgreement({ orderId, termsHash }: { orderId: string; termsHash: string }) {
  const { run, loading, error } = useAction();
  const [checked, setChecked] = useState(false);
  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1" />
        <span>I have read and accept these terms</span>
      </label>
      <Button loading={loading} disabled={!checked} onClick={() => run(`/api/orders/${orderId}/agreement`, { json: { termsHash, accept: true } })}>
        Accept agreement
      </Button>
    </div>
  );
}

export function CancelOrder({ orderId, label }: { orderId: string; label: string }) {
  const { run, loading, error } = useAction();
  return (
    <div className="space-y-2">
      {error && <Alert variant="error">{error}</Alert>}
      <Button
        variant="secondary" loading={loading}
        onClick={() => { if (window.confirm("Cancel this order? This cannot be undone.")) void run(`/api/orders/${orderId}/cancel`, { json: {} }); }}
      >
        {label}
      </Button>
    </div>
  );
}

/** Provider: upload the finished video. */
export function DeliveryUpload({ orderId }: { orderId: string }) {
  const { run, loading, error } = useAction();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    if (note) form.set("note", note);
    await run(`/api/orders/${orderId}/delivery`, { form });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      <div>
        <label htmlFor="video" className="mb-1 block text-sm font-medium text-slate-700">Video file</label>
        <input id="video" type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
        <p className="mt-1 text-xs text-slate-500">MP4, MOV, M4V or WebM.</p>
      </div>
      <div>
        <label htmlFor="delivery-note" className="mb-1 block text-sm font-medium text-slate-700">Note to client (optional)</label>
        <textarea id="delivery-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={area} />
      </div>
      <Button type="submit" loading={loading} disabled={!file}>{loading ? "Uploading…" : "Upload delivery"}</Button>
    </form>
  );
}

/** Client: approve (releases payment) or request a revision. */
export function ClientDecision({ orderId, revisionsLeft }: { orderId: string; revisionsLeft: number }) {
  const approve = useAction();
  const revise = useAction();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  return (
    <div className="space-y-4">
      {approve.error && <Alert variant="error">{approve.error}</Alert>}
      <Button loading={approve.loading} onClick={() => approve.run(`/api/orders/${orderId}/approve`)}>Approve & release payment</Button>
      <p className="text-xs text-slate-500">Approving releases the held payment to the provider and completes the order.</p>

      {revisionsLeft > 0 ? (
        open ? (
          <form
            className="space-y-2"
            onSubmit={async (e) => { e.preventDefault(); if (await revise.run(`/api/orders/${orderId}/revision`, { json: { note } })) setOpen(false); }}
          >
            {revise.error && <Alert variant="error">{revise.error}</Alert>}
            <label htmlFor="rev-note" className="block text-sm font-medium text-slate-700">What should change?</label>
            <textarea id="rev-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={area} />
            {revise.fe("note") && <p className="text-xs text-red-600">{revise.fe("note")}</p>}
            <div className="flex gap-2">
              <Button type="submit" variant="secondary" loading={revise.loading}>Send revision request</Button>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <Button variant="secondary" onClick={() => setOpen(true)}>Request revision ({revisionsLeft} left)</Button>
        )
      ) : (
        <p className="text-sm text-slate-600">No revisions left on this order.</p>
      )}
    </div>
  );
}

/** Client or provider: open a dispute while work is in progress or delivered. */
export function OpenDispute({ orderId }: { orderId: string }) {
  const { run, loading, error, fe } = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <button onClick={() => setOpen(true)} className="text-sm font-medium text-red-600 hover:underline">Open a dispute</button>;
  return (
    <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); await run(`/api/orders/${orderId}/dispute`, { json: { reason } }); }}>
      {error && <Alert variant="error">{error}</Alert>}
      <label htmlFor="dispute-reason" className="block text-sm font-medium text-slate-700">What went wrong?</label>
      <textarea id="dispute-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={area} />
      {fe("reason") && <p className="text-xs text-red-600">{fe("reason")}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="danger" loading={loading}>Submit dispute</Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
