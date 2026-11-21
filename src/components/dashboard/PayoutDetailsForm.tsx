"use client";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useHydrated } from "@/components/ui/useHydrated";
import { useT } from "@/i18n/client";
import { useAction } from "@/components/orders/useAction";
import { cleanCardNumber, formatCardNumber, isValidCardNumber, maskCard } from "@/lib/cardFormat";

/** The card a creator's earnings are sent to. The number is encrypted on the server; only the last 4 digits come back. */
export function PayoutDetailsForm({ holder, last4 }: { holder: string | null; last4: string | null }) {
  const { run, loading, error, fe } = useAction();
  const t = useT();
  const ready = useHydrated(); // a click before React is ready would put the card number into the URL
  const [name, setName] = useState(holder ?? "");
  const [number, setNumber] = useState("");
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    // Money will go to this card, so ask first, with what was typed written out to read once more. A number that fails the
    // check digit skips the question: the server answers it with the usual message under the field.
    const digits = cleanCardNumber(number);
    if (isValidCardNumber(digits) && name.trim() && !window.confirm(t("{card} ({holder}) kartasi saqlansinmi? Daromadingiz shu kartaga oʻtkaziladi.", { card: formatCardNumber(digits), holder: name.trim() }))) return;
    const done = await run("/api/profile/payout", { method: "PUT", json: { holder: name, cardNumber: number } }, () => setNumber(""));
    if (done) setSaved(true);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {last4 && <p className="font-semibold">{t("Saqlangan karta:")} <span className="tabular-nums">{maskCard(last4)}</span>{holder ? `, ${holder}` : ""}</p>}
      {error && <Alert variant="error">{error}</Alert>}
      {saved && <Alert variant="success">{t("Karta saqlandi.")}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Karta egasi")} autoComplete="off" placeholder={t("ISM FAMILIYA")} value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} error={fe("holder")} hint={t("Karta ustida yozilgandek")} />
        <Field label={t("Karta raqami")} inputMode="numeric" autoComplete="off" placeholder="8600 0000 0000 0000" value={number} onChange={(e) => { setNumber(e.target.value); setSaved(false); }} error={fe("cardNumber")} hint={t("Serverda shifrlab saqlanadi")} />
      </div>
      <Button type="submit" loading={loading} disabled={!ready}>{last4 ? t("Kartani yangilash") : t("Kartani saqlash")}</Button>
    </form>
  );
}
