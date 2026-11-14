"use client";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { useAction } from "@/components/orders/useAction";
import { formatUZS } from "@/lib/format";
import { receiptTooBigMessage, RECEIPT_MAX_BYTES, RECEIPT_MAX_MB } from "@/lib/payments/receiptPure";

type Props = {
  orderId: string;
  amount: number;
  reference: string;
  card: string;
  holder: string;
  bank: string | null;
  /** The client already pressed "I paid" and an admin has not checked the money yet. */
  waiting: boolean;
};

/** Checkout when clients pay by sending money to the owner's card (PAYMENT_PROVIDER=manual). */
export function ManualTransfer({ orderId, amount, reference, card, holder, bank, waiting }: Props) {
  const { run, loading, error } = useAction();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>();

  function pick(chosen: File | null) {
    setFileError(undefined);
    if (chosen && chosen.size > RECEIPT_MAX_BYTES) {
      setFile(null);
      setFileError(receiptTooBigMessage); // caught here so a phone never uploads a huge file first
      return;
    }
    setFile(chosen);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.set("orderId", orderId);
    form.set("receipt", file);
    await run("/api/payments/manual/submit", { form });
  }

  if (waiting) {
    return (
      <div className="space-y-5">
        <Alert variant="info">
          <strong>Toʻlovingiz tekshirilmoqda.</strong> Administrator pulni koʻrgach tasdiqlaydi, soʻng ijodkor ishni boshlaydi.
        </Alert>
        <ButtonLink href={`/orders/${orderId}`} variant="secondary" className="w-full">Buyurtmaga qaytish</ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Alert variant="info">
        Pulni quyidagi kartaga oʻtkazing, bank ilovasidagi chekni yuklang va <strong>Men toʻladim</strong> tugmasini bosing. Administrator pulni tekshirgach, ish boshlanadi.
      </Alert>
      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-semibold text-ink-soft">Karta raqami</dt>
            <dd className="mt-0.5 text-lg font-bold tabular-nums tracking-widest sm:text-xl">{card}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink-soft">Karta egasi</dt>
            <dd className="mt-0.5 font-bold">{holder}{bank ? `, ${bank}` : ""}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink-soft">Aniq summa</dt>
            <dd className="mt-0.5 text-xl font-extrabold tabular-nums tracking-tight">{formatUZS(amount)}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink-soft">Izoh kodi (oʻtkazma izohiga yozing)</dt>
            <dd className="mt-0.5 text-xl font-extrabold tracking-widest">{reference}</dd>
          </div>
        </dl>
      </Card>

      <Field
        label="Toʻlov cheki"
        id="receipt"
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
        hint={`Bank ilovasidagi chek: rasm (JPG, PNG, WebP) yoki PDF, eng koʻpi ${RECEIPT_MAX_MB} MB.`}
        error={fileError}
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
        className="py-2"
      />
      <Button type="submit" size="lg" loading={loading} disabled={!file} className="w-full">
        {loading ? "Yuklanmoqda…" : "Men toʻladim"}
      </Button>
      <p className="text-center text-sm text-ink-soft">Chekni yuklamasdan toʻlovni yuborib boʻlmaydi. Pul tushmasa, toʻlov rad etiladi.</p>
    </form>
  );
}
