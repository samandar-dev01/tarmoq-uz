"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatUZS } from "@/lib/format";

type Intent = { paymentId: string; amount: number; fee: number; payout: number };

const TEST_CARDS = [
  { label: "Success", number: "4242 4242 4242 4242" },
  { label: "Declined", number: "4000 0000 0000 0002" },
  { label: "Insufficient funds", number: "4000 0000 0000 9995" },
];

export function CheckoutForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});

  const loadIntent = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/payments/sandbox/intent", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }),
      });
      const json = await res.json();
      if (!res.ok) { setLoadError(json.error ?? "Could not start the payment."); return; }
      setIntent({ paymentId: json.payment.id, amount: json.payment.amount, fee: json.fees.fee, payout: json.fees.payout });
    } catch {
      setLoadError("Network error. Please try again.");
    }
  }, [orderId]);

  useEffect(() => { void loadIntent(); }, [loadIntent]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!intent) return;
    setError(null);
    const errs: Record<string, string> = {};
    const m = /^\s*(\d{1,2})\s*\/\s*(\d{2}|\d{4})\s*$/.exec(expiry);
    if (!number.trim()) errs.number = "Enter the card number.";
    if (!m) errs.expiry = "Use the format MM/YY.";
    if (!/^\d{3,4}$/.test(cvc)) errs.cvc = "Enter the 3-digit code.";
    setFieldError(errs);
    if (Object.keys(errs).length || !m) return;

    setPaying(true);
    try {
      const res = await fetch("/api/payments/sandbox/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, paymentId: intent.paymentId, cardNumber: number, expMonth: Number(m[1]), expYear: Number(m[2]), cvc }),
      });
      const json = await res.json();
      if (res.ok) {
        router.replace(`/orders/${orderId}?paid=1`);
        router.refresh();
        return;
      }
      setError(json.error ?? "The payment failed.");
      // A declined attempt is closed on the server; fetch a fresh attempt so the client can retry.
      if (res.status === 402 || res.status === 409) await loadIntent();
    } catch {
      setError("Network error. You have not been charged. Please try again.");
    } finally {
      setPaying(false);
    }
  }

  if (loadError) return <ErrorState message={loadError} onRetry={loadIntent} />;
  if (!intent) return <div className="flex items-center gap-2 py-10 text-sm text-slate-600"><Spinner /> Preparing your payment…</div>;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Alert variant="info"><strong>Sandbox mode.</strong> No real money is charged. Use a test card below.</Alert>
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        {TEST_CARDS.map((c) => (
          <button
            key={c.number} type="button"
            onClick={() => { setNumber(c.number); setExpiry("12/34"); setCvc("123"); }}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:border-indigo-400"
          >
            Fill: {c.label}
          </button>
        ))}
      </div>

      <Field label="Card number" inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" value={number} onChange={(e) => setNumber(e.target.value)} error={fieldError.number} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiry (MM/YY)" inputMode="numeric" autoComplete="off" placeholder="12/34" value={expiry} onChange={(e) => setExpiry(e.target.value)} error={fieldError.expiry} />
        <Field label="Security code (CVC)" inputMode="numeric" autoComplete="off" placeholder="123" value={cvc} onChange={(e) => setCvc(e.target.value)} error={fieldError.cvc} />
      </div>
      <Button type="submit" loading={paying} className="w-full">{paying ? "Processing…" : `Pay ${formatUZS(intent.amount)}`}</Button>
      <p className="text-center text-xs text-slate-500">Card details are checked on the server and never stored; only the card brand and last 4 digits are kept.</p>
    </form>
  );
}
