"use client";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useHydrated } from "@/components/ui/useHydrated";
import { useT } from "@/i18n/client";
import { useAction } from "./useAction";

export function NewOrderForm({ serviceId }: { serviceId: string }) {
  const { run, loading, error, fe, router } = useAction();
  const t = useT();
  const ready = useHydrated();
  const [brief, setBrief] = useState("");
  const [eventDate, setEventDate] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await run("/api/orders", { json: { serviceId, brief, eventDate } }, (data) => router.push(`/orders/${data.order.id}`));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error && <Alert variant="error">{error}</Alert>}
      <Field
        as="textarea"
        label={t("Nima kerakligini yozing")}
        rows={6}
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        placeholder={t("Video nima uchun, qayerda va qachon suratga olinadi? Qanday uslub yoqadi?")}
        error={fe("brief")}
      />
      <Field label={t("Tadbir yoki syomka sanasi (ixtiyoriy)")} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} error={fe("eventDate")} />
      <p className="text-sm text-ink-soft">{t("Hozircha pul yechilmaydi. Ijodkor avval shartlarni yuboradi, siz koʻrib chiqib qabul qilasiz.")}</p>
      <Button type="submit" size="lg" loading={loading} disabled={!ready} className="w-full sm:w-auto">{loading ? t("Yuborilmoqda…") : t("Buyurtma yuborish")}</Button>
    </form>
  );
}
