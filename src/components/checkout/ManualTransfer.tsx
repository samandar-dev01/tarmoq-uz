"use client";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { useAction } from "@/components/orders/useAction";
import { useLocale, useT } from "@/i18n/client";
import { formatUZS } from "@/lib/format";
import { RECEIPT_MAX_BYTES, RECEIPT_MAX_MB } from "@/lib/payments/receiptPure";

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
  const t = useT();
  const locale = useLocale();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>();

  function pick(chosen: File | null) {
    setFileError(undefined);
    if (chosen && chosen.size > RECEIPT_MAX_BYTES) {
      setFile(null);
      setFileError(t("Fayl juda katta (eng koʻpi {max} MB).", { max: RECEIPT_MAX_MB })); // caught here so a phone never uploads a huge file first
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
          <strong>{t("Toʻlovingiz tekshirilmoqda.")}</strong> {t("Administrator pulni koʻrgach tasdiqlaydi, soʻng ijodkor ishni boshlaydi.")}
        </Alert>
        <ButtonLink href={`/orders/${orderId}`} variant="secondary" className="w-full">{t("Buyurtmaga qaytish")}</ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Alert variant="info">
        {t("Pulni quyidagi kartaga oʻtkazing, bank ilovasidagi chekni yuklang va")} <strong>{t("Men toʻladim")}</strong> {t("tugmasini bosing. Administrator pulni tekshirgach, ish boshlanadi.")}
      </Alert>
      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-semibold text-ink-soft">{t("Karta raqami")}</dt>
            <dd className="mt-0.5 text-lg font-bold tabular-nums tracking-widest sm:text-xl">{card}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink-soft">{t("Karta egasi")}</dt>
            <dd className="mt-0.5 font-bold">{holder}{bank ? `, ${bank}` : ""}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink-soft">{t("Aniq summa")}</dt>
            <dd className="mt-0.5 text-xl font-extrabold tabular-nums tracking-tight">{formatUZS(amount, locale)}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink-soft">{t("Izoh kodi (oʻtkazma izohiga yozing)")}</dt>
            <dd className="mt-0.5 text-xl font-extrabold tracking-widest">{reference}</dd>
          </div>
        </dl>
      </Card>

      <Field
        label={t("Toʻlov cheki")}
        id="receipt"
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
        hint={t("Bank ilovasidagi chek: rasm (JPG, PNG, WebP) yoki PDF, eng koʻpi {max} MB.", { max: RECEIPT_MAX_MB })}
        error={fileError}
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
        className="py-2"
      />
      <Button type="submit" size="lg" loading={loading} disabled={!file} className="w-full">
        {loading ? t("Yuklanmoqda…") : t("Men toʻladim")}
      </Button>
      <p className="text-center text-sm text-ink-soft">{t("Chekni yuklamasdan toʻlovni yuborib boʻlmaydi. Pul tushmasa, toʻlov rad etiladi.")}</p>
    </form>
  );
}
