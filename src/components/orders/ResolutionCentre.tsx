"use client";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useHydrated } from "@/components/ui/useHydrated";
import { useAction } from "./useAction";
import { useT } from "@/i18n/client";

/** Ask the other side for more time, or to cancel the paid order. */
export function RequestForm({ orderId, canExtend }: { orderId: string; canExtend: boolean }) {
  const { run, loading, error, fe } = useAction();
  const t = useT();
  const ready = useHydrated();
  const [type, setType] = useState<"EXTEND" | "CANCEL">(canExtend ? "EXTEND" : "CANCEL");
  const [extraDays, setDays] = useState("2");
  const [reason, setReason] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await run(`/api/orders/${orderId}/requests`, { json: { type, reason, extraDays: type === "EXTEND" && extraDays !== "" ? Number(extraDays) : undefined } }, () => setReason(""));
  };
  return (
    <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
      <Field as="select" id="request-type" label={t("Nima soʻraysiz?")} value={type} onChange={(e) => setType(e.target.value as "EXTEND" | "CANCEL")}>
        {canExtend && <option value="EXTEND">{t("Muddatni uzaytirish")}</option>}
        <option value="CANCEL">{t("Buyurtmani bekor qilish")}</option>
      </Field>
      {type === "EXTEND" ? (
        <Field id="request-days" label={t("Necha kunga?")} type="number" inputMode="numeric" min={1} max={30} value={extraDays} onChange={(e) => setDays(e.target.value)} error={fe("extraDays")} />
      ) : (
        <p className="text-sm text-ink-soft">{t("Ikkinchi tomon rozi boʻlsa, administrator toʻlovni qaytaradi va buyurtmani yopadi.")}</p>
      )}
      <Field as="textarea" id="request-reason" label={t("Sababi")} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} error={fe("reason")} />
      {error && <Alert variant="error">{error}</Alert>}
      <Button type="submit" variant="secondary" loading={loading} disabled={!ready}>{t("Soʻrovni yuborish")}</Button>
    </form>
  );
}

export function RequestActions({ orderId, requestId, mine }: { orderId: string; requestId: string; mine: boolean }) {
  const { run, loading, error } = useAction();
  const t = useT();
  const ready = useHydrated();
  const act = (action: "accept" | "decline" | "withdraw") => run(`/api/orders/${orderId}/requests/${requestId}`, { json: { action } });
  return (
    <div className="mt-3 space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {mine ? (
          <Button type="button" variant="secondary" size="sm" loading={loading} disabled={!ready} onClick={() => act("withdraw")}>{t("Qaytarib olish")}</Button>
        ) : (
          <>
            <Button type="button" size="sm" loading={loading} disabled={!ready} onClick={() => act("accept")}>{t("Rozi boʻlish")}</Button>
            <Button type="button" variant="ghost" size="sm" disabled={!ready || loading} onClick={() => act("decline")}>{t("Rad etish")}</Button>
          </>
        )}
      </div>
    </div>
  );
}
