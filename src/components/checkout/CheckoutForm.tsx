"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { coverArt } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatUZS } from "@/lib/format";

type Intent = { paymentId: string; amount: number; fee: number; payout: number };

const TEST_CARDS = [
  { label: "Muvaffaqiyatli", number: "4242 4242 4242 4242" },
  { label: "Rad etilgan", number: "4000 0000 0000 0002" },
  { label: "Mablagʻ yetarli emas", number: "4000 0000 0000 9995" },
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
      if (!res.ok) { setLoadError(json.error ?? "Toʻlovni boshlab boʻlmadi."); return; }
      setIntent({ paymentId: json.payment.id, amount: json.payment.amount, fee: json.fees.fee, payout: json.fees.payout });
    } catch {
      setLoadError("Internet aloqasida muammo. Qayta urinib koʻring.");
    }
  }, [orderId]);

  useEffect(() => { void loadIntent(); }, [loadIntent]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!intent) return;
    setError(null);
    const errs: Record<string, string> = {};
    const m = /^\s*(\d{1,2})\s*\/\s*(\d{2}|\d{4})\s*$/.exec(expiry);
    if (!number.trim()) errs.number = "Karta raqamini kiriting.";
    if (!m) errs.expiry = "MM/YY formatida kiriting.";
    if (!/^\d{3,4}$/.test(cvc)) errs.cvc = "3 xonali kodni kiriting.";
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
      setError(json.error ?? "Toʻlov amalga oshmadi.");
      // A declined attempt is closed on the server; fetch a fresh attempt so the client can retry.
      if (res.status === 402 || res.status === 409) await loadIntent();
    } catch {
      setError("Internet aloqasida muammo. Pul yechilmadi. Qayta urinib koʻring.");
    } finally {
      setPaying(false);
    }
  }

  if (loadError) return <ErrorState message={loadError} onRetry={loadIntent} />;
  if (!intent) return <div className="flex items-center gap-3 py-10 font-medium text-ink-soft"><Spinner /> Toʻlov tayyorlanmoqda…</div>;

  // A live preview of the card, filled in as you type.
  const digits = number.replace(/\D/g, "").slice(0, 19);
  const shownNumber = (digits + "•".repeat(Math.max(0, 16 - digits.length))).replace(/(.{4})/g, "$1 ").trim();
  const brand = digits.startsWith("4") ? "VISA" : digits.startsWith("5") ? "Mastercard" : "";

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Alert variant="info"><strong>Sinov rejimi.</strong> Haqiqiy pul yechilmaydi. Quyidagi test kartalaridan birini tanlang.</Alert>
      {error && <Alert variant="error">{error}</Alert>}

      <div aria-hidden="true" className="overflow-hidden rounded-card border-2 border-ink bg-ink text-white shadow-pop">
        <div className="relative h-10 overflow-hidden border-b-2 border-ink">
          <div className="ikat absolute -inset-3" style={{ background: coverArt(orderId) }} />
        </div>
        <div className="space-y-5 p-5">
          <p className="text-lg font-bold tabular-nums tracking-widest sm:text-xl">{shownNumber}</p>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-white/60">Amal qilish muddati</p>
              <p className="font-semibold">{expiry || "MM/YY"}</p>
            </div>
            <p className="font-display text-lg font-bold">{brand}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TEST_CARDS.map((c) => (
          <Button
            key={c.number} type="button" variant="chip"
            onClick={() => { setNumber(c.number); setExpiry("12/34"); setCvc("123"); }}
          >
            Toʻldirish: {c.label}
          </Button>
        ))}
      </div>

      <Field label="Karta raqami" inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" value={number} onChange={(e) => setNumber(e.target.value)} error={fieldError.number} />
      <div className="grid grid-cols-2 items-end gap-4">
        <Field label="Amal qilish muddati (MM/YY)" inputMode="numeric" autoComplete="off" placeholder="12/34" value={expiry} onChange={(e) => setExpiry(e.target.value)} error={fieldError.expiry} />
        <Field label="Xavfsizlik kodi (CVC)" inputMode="numeric" autoComplete="off" placeholder="123" value={cvc} onChange={(e) => setCvc(e.target.value)} error={fieldError.cvc} />
      </div>
      <Button type="submit" size="lg" loading={paying} className="w-full">{paying ? "Jarayonda…" : `${formatUZS(intent.amount)} toʻlash`}</Button>
      <p className="text-center text-sm text-ink-soft">Karta maʼlumotlari serverda tekshiriladi va saqlanmaydi: faqat karta turi va oxirgi 4 ta raqam saqlanadi.</p>
    </form>
  );
}
