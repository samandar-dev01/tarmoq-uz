"use client";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useHydrated } from "@/components/ui/useHydrated";
import { useAction } from "@/components/orders/useAction";
import { useT } from "@/i18n/client";

/** The creator's form for a custom offer in a conversation. */
export function OfferForm({ conversationId, services }: { conversationId: string; services: { id: string; title: string; price: number; deliveryDays: number; revisions: number }[] }) {
  const { run, loading, error, fe } = useAction();
  const t = useT();
  const ready = useHydrated();
  const blank = (id: string) => {
    const s = services.find((x) => x.id === id) ?? services[0]!;
    return { serviceId: s.id, description: "", price: String(s.price), days: String(s.deliveryDays), revisions: String(s.revisions) };
  };
  const [form, setForm] = useState(() => blank(services[0]!.id));
  const [sent, setSent] = useState(false);
  const num = (v: string) => (v === "" ? undefined : Number(v));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSent(false);
    await run(`/api/conversations/${conversationId}/offers`, {
      json: { serviceId: form.serviceId, description: form.description, price: num(form.price), deliveryDays: num(form.days), revisions: num(form.revisions) },
    }, () => { setForm(blank(form.serviceId)); setSent(true); });
  };
  return (
    <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
      <Field as="select" id="offer-service" label={t("Qaysi paket asosida")} value={form.serviceId} onChange={(e) => setForm({ ...blank(e.target.value), description: form.description })} error={fe("serviceId")}>
        {services.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
      </Field>
      <Field as="textarea" id="offer-description" label={t("Taklif tavsifi")} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} error={fe("description")} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="offer-price" label={t("Narx (soʻm)")} type="number" inputMode="numeric" min={0} step={10000} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} error={fe("price")} />
        <Field id="offer-days" label={t("Muddat (kun)")} type="number" inputMode="numeric" min={1} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} error={fe("deliveryDays")} />
        <Field id="offer-revisions" label={t("Tuzatishlar soni")} type="number" inputMode="numeric" min={0} value={form.revisions} onChange={(e) => setForm({ ...form, revisions: e.target.value })} error={fe("revisions")} />
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      {sent && !error && <Alert variant="success">{t("Taklif yuborildi.")}</Alert>}
      <Button type="submit" loading={loading} disabled={!ready}>{t("Taklifni yuborish")}</Button>
    </form>
  );
}

/** What a person can do with a pending offer: the client accepts (after reading) or declines; the creator takes it back. */
export function OfferActions({ offerId, mine }: { offerId: string; mine: boolean }) {
  const { run, loading, error, router } = useAction();
  const t = useT();
  const ready = useHydrated();
  const [read, setRead] = useState(false);
  const act = (action: "accept" | "decline" | "withdraw") =>
    run(`/api/offers/${offerId}`, { json: { action, ...(action === "accept" ? { accept: true } : {}) } }, (data) => {
      if (data.orderId) router.push(`/checkout/${data.orderId}`);
    });
  return (
    <div className="mt-3 space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      {mine ? (
        <Button type="button" variant="secondary" size="sm" loading={loading} disabled={!ready} onClick={() => act("withdraw")}>{t("Qaytarib olish")}</Button>
      ) : (
        <>
          <label className="flex cursor-pointer items-start gap-3 text-sm font-medium">
            <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{t("Shartlar bilan tanishib chiqdim va qabul qilaman")}</span>
          </label>
          <div className="flex gap-2">
            <Button type="button" size="sm" loading={loading} disabled={!ready || !read} onClick={() => act("accept")}>{t("Qabul qilish")}</Button>
            <Button type="button" variant="ghost" size="sm" disabled={!ready || loading} onClick={() => act("decline")}>{t("Rad etish")}</Button>
          </div>
        </>
      )}
    </div>
  );
}
