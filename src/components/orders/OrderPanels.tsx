"use client";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useHydrated } from "@/components/ui/useHydrated";
import { useT } from "@/i18n/client";
import { useAction } from "./useAction";

/**
 * Provider: send the terms, or change them after they were sent. The first send folds the form away (the page then shows
 * the "sent" state), changing is a deliberate button with the number of changes left, and a send that is already settling
 * cannot be repeated by a second tap. The server holds the same line (src/lib/agreements.ts, MAX_TERMS_VERSIONS).
 */
export function ProposeTerms({ orderId, defaults, update, changesLeft }: { orderId: string; defaults: { price: number; days: number; revisions: number; notes: string }; update: boolean; changesLeft: number }) {
  const { run, loading, error, fe } = useAction();
  const t = useT();
  const ready = useHydrated();
  const [price, setPrice] = useState(String(defaults.price));
  const [days, setDays] = useState(String(defaults.days));
  const [revisions, setRevisions] = useState(String(defaults.revisions));
  const [notes, setNotes] = useState(defaults.notes);
  const [open, setOpen] = useState(!update);
  const [sent, setSent] = useState(false);

  const num = (v: string) => (v === "" ? undefined : Number(v));
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (sent) return;
    const done = await run(`/api/orders/${orderId}/propose`, { json: { price: num(price), deliveryDays: num(days), revisions: num(revisions), notes: notes || undefined } });
    if (!done) return;
    setSent(true);
    if (update) { setOpen(false); setSent(false); }
  };

  if (!open) {
    return changesLeft > 0 ? (
      <Button variant="secondary" onClick={() => setOpen(true)}>{t("Shartlarni oʻzgartirish ({left} ta qoldi)", { left: changesLeft })}</Button>
    ) : (
      <Alert variant="info">{t("Shartlarni boshqa oʻzgartirib boʻlmaydi (eng koʻpi 3 marta). Kerak boʻlsa, mijoz bilan suhbatda kelishib oling.")}</Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error && <Alert variant="error">{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("Narx (soʻm)")} type="number" inputMode="numeric" min={0} step={10000} value={price} onChange={(e) => setPrice(e.target.value)} error={fe("price")} />
        <Field label={t("Muddat (kun)")} type="number" inputMode="numeric" min={1} value={days} onChange={(e) => setDays(e.target.value)} error={fe("deliveryDays")} />
        <Field label={t("Tuzatishlar soni")} type="number" inputMode="numeric" min={0} value={revisions} onChange={(e) => setRevisions(e.target.value)} error={fe("revisions")} />
      </div>
      <Field as="textarea" label={t("Izoh (ixtiyoriy)")} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("Ish hajmi, joylashuv, nimalar kirmasligi…")} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={loading} disabled={!ready || sent}>{update ? t("Yangilangan shartlarni yuborish") : t("Shartlarni mijozga yuborish")}</Button>
        {update && <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("Bekor qilish")}</Button>}
      </div>
    </form>
  );
}

/** Client: accept the exact terms version shown (identified by its hash). */
export function AcceptAgreement({ orderId, termsHash }: { orderId: string; termsHash: string }) {
  const { run, loading, error } = useAction();
  const t = useT();
  const [checked, setChecked] = useState(false);
  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      <label className="flex cursor-pointer items-start gap-3 font-medium">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
        <span>{t("Shartlar bilan tanishib chiqdim va qabul qilaman")}</span>
      </label>
      <Button loading={loading} disabled={!checked} onClick={() => run(`/api/orders/${orderId}/agreement`, { json: { termsHash, accept: true } })}>
        {t("Kelishuvni qabul qilish")}
      </Button>
    </div>
  );
}

export function CancelOrder({ orderId, label }: { orderId: string; label: string }) {
  const { run, loading, error } = useAction();
  const t = useT();
  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      <Button
        variant="secondary" loading={loading}
        onClick={() => { if (window.confirm(t("Buyurtma bekor qilinsinmi? Bu amalni qaytarib boʻlmaydi."))) void run(`/api/orders/${orderId}/cancel`, { json: {} }); }}
      >
        {label}
      </Button>
    </div>
  );
}

/** Provider: upload the finished video. */
export function DeliveryUpload({ orderId }: { orderId: string }) {
  const { run, loading, error } = useAction();
  const t = useT();
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
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      <Field
        label={t("Video fayl")}
        id="video"
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm"
        hint={t("MP4, MOV, M4V yoki WebM.")}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="py-2"
      />
      <Field as="textarea" label={t("Mijozga izoh (ixtiyoriy)")} id="delivery-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      <Button type="submit" loading={loading} disabled={!file}>{loading ? t("Yuklanmoqda…") : t("Ishni topshirish")}</Button>
    </form>
  );
}

/** Client: approve (releases payment) or request a revision. */
export function ClientDecision({ orderId, revisionsLeft }: { orderId: string; revisionsLeft: number }) {
  const approve = useAction();
  const revise = useAction();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  return (
    <div className="space-y-5">
      {approve.error && <Alert variant="error">{approve.error}</Alert>}
      <div>
        <Button size="lg" loading={approve.loading} onClick={() => approve.run(`/api/orders/${orderId}/approve`)}>{t("Qabul qilish va toʻlovni oʻtkazish")}</Button>
        <p className="mt-2 text-sm text-ink-soft">{t("Qabul qilsangiz, ushlab turilgan pul ijodkorga oʻtadi va buyurtma yakunlanadi.")}</p>
      </div>

      {revisionsLeft > 0 ? (
        open ? (
          <form
            className="space-y-3"
            onSubmit={async (e) => { e.preventDefault(); if (await revise.run(`/api/orders/${orderId}/revision`, { json: { note } })) setOpen(false); }}
          >
            {revise.error && <Alert variant="error">{revise.error}</Alert>}
            <Field as="textarea" label={t("Nimani oʻzgartirish kerak?")} id="rev-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} error={revise.fe("note")} />
            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="secondary" loading={revise.loading}>{t("Tuzatish soʻrovini yuborish")}</Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("Bekor qilish")}</Button>
            </div>
          </form>
        ) : (
          <Button variant="secondary" onClick={() => setOpen(true)}>{t("Tuzatish soʻrash ({left} ta qoldi)", { left: revisionsLeft })}</Button>
        )
      ) : (
        <p className="text-ink-soft">{t("Bu buyurtmada tuzatishlar qolmagan.")}</p>
      )}
    </div>
  );
}

/** Client or provider: open a dispute while work is in progress or delivered. */
export function OpenDispute({ orderId }: { orderId: string }) {
  const { run, loading, error, fe } = useAction();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <Button variant="secondary" onClick={() => setOpen(true)}>{t("Nizo ochish")}</Button>;
  return (
    <form className="w-full max-w-lg space-y-3" onSubmit={async (e) => { e.preventDefault(); await run(`/api/orders/${orderId}/dispute`, { json: { reason } }); }}>
      {error && <Alert variant="error">{error}</Alert>}
      <Field as="textarea" label={t("Nima notoʻgʻri ketdi?")} id="dispute-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} error={fe("reason")} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="danger" loading={loading}>{t("Nizoni yuborish")}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("Bekor qilish")}</Button>
      </div>
    </form>
  );
}
