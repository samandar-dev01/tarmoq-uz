"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { useAction } from "@/components/orders/useAction";
import { useLocale, useT } from "@/i18n/client";
import { formatUZS } from "@/lib/format";
import { cleanCardNumber, formatCardNumber } from "@/lib/cardFormat";
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

/**
 * Copies text to the clipboard. The call is made straight from the tap (no waiting first), which phones require.
 * Older browsers and pages without clipboard access fall back to a hidden field and the old copy command.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // refused (no permission, or not a secure page): try the old way below
  }
  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(field);
    field.select();
    field.setSelectionRange(0, text.length);
    const done = document.execCommand("copy");
    document.body.removeChild(field);
    return done;
  } catch {
    return false;
  }
}

/** Checkout when clients pay by sending money to the owner's card (PAYMENT_PROVIDER=manual). */
export function ManualTransfer({ orderId, amount, reference, card, holder, bank, waiting }: Props) {
  const { run, loading, error } = useAction();
  const t = useT();
  const locale = useLocale();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>();
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  // Shown with spaces to be read; copied as bare digits, which every bank app accepts.
  const cardDigits = cleanCardNumber(card);
  const cardShown = /^\d{16}$/.test(cardDigits) ? formatCardNumber(cardDigits) : card;

  async function copyCard() {
    const ok = await copyText(cardDigits || card);
    setCopied(ok ? "yes" : "no");
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(null), 2500);
  }

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
            <dd className="mt-1">
              <button
                type="button"
                onClick={copyCard}
                aria-label={`${t("Karta raqamini nusxalash")}: ${cardShown}`}
                className="flex min-h-11 w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-ctl border border-line-strong bg-paper px-3 py-2 text-left transition-colors duration-150 hover:bg-paper-deep active:bg-paper-deep"
              >
                {/* On a phone the label drops under the number instead of squeezing it onto two lines. */}
                <span className="whitespace-nowrap text-lg font-bold tabular-nums tracking-wide sm:text-xl sm:tracking-widest">{cardShown}</span>
                <span className={`flex shrink-0 items-center gap-1.5 text-sm font-semibold ${copied === "yes" ? "text-turquoise-deep" : "text-ink-soft"}`}>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {copied === "yes" ? <path d="m5.5 12.5 4.5 4.5 8.5-9" /> : <><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5.5 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v.5" /></>}
                  </svg>
                  {copied === "yes" ? t("Nusxalandi") : t("Nusxalash")}
                </span>
              </button>
              <span className="sr-only" role="status" aria-live="polite">{copied === "yes" ? t("Karta raqami nusxalandi") : ""}</span>
              {copied === "no" && <p className="mt-1 text-sm font-semibold text-pomegranate-deep" role="alert">{t("Nusxalab boʻlmadi. Raqamni qoʻlda koʻchiring.")}</p>}
            </dd>
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
