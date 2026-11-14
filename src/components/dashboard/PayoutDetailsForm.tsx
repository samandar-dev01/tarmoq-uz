"use client";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useHydrated } from "@/components/ui/useHydrated";
import { useAction } from "@/components/orders/useAction";
import { maskCard } from "@/lib/cardFormat";

/** The card a creator's earnings are sent to. The number is encrypted on the server; only the last 4 digits come back. */
export function PayoutDetailsForm({ holder, last4 }: { holder: string | null; last4: string | null }) {
  const { run, loading, error, fe } = useAction();
  const ready = useHydrated(); // a click before React is ready would put the card number into the URL
  const [name, setName] = useState(holder ?? "");
  const [number, setNumber] = useState("");
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    const done = await run("/api/profile/payout", { method: "PUT", json: { holder: name, cardNumber: number } }, () => setNumber(""));
    if (done) setSaved(true);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {last4 && <p className="font-semibold">Saqlangan karta: <span className="tabular-nums">{maskCard(last4)}</span>{holder ? `, ${holder}` : ""}</p>}
      {error && <Alert variant="error">{error}</Alert>}
      {saved && <Alert variant="success">Karta saqlandi.</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Karta egasi" autoComplete="off" placeholder="ISM FAMILIYA" value={name} onChange={(e) => setName(e.target.value)} error={fe("holder")} hint="Karta ustida yozilgandek" />
        <Field label="Karta raqami" inputMode="numeric" autoComplete="off" placeholder="8600 0000 0000 0000" value={number} onChange={(e) => setNumber(e.target.value)} error={fe("cardNumber")} hint="Serverda shifrlab saqlanadi" />
      </div>
      <Button type="submit" loading={loading} disabled={!ready}>{last4 ? "Kartani yangilash" : "Kartani saqlash"}</Button>
    </form>
  );
}
