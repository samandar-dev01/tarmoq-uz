"use client";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useHydrated } from "@/components/ui/useHydrated";
import { useAction } from "@/components/orders/useAction";
import { useT } from "@/i18n/client";

/** The creator's one answer under a review of their work: a button that opens a small form. */
export function ReviewReply({ reviewId }: { reviewId: string }) {
  const t = useT();
  const ready = useHydrated();
  const { run, loading, error, fe } = useAction();
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await run(`/api/reviews/${reviewId}/reply`, { json: { reply } });
  };
  if (!open) return <Button type="button" variant="secondary" size="sm" className="mt-3" disabled={!ready} onClick={() => setOpen(true)}>{t("Javob yozish")}</Button>;
  return (
    <form onSubmit={submit} className="mt-3 space-y-3" noValidate>
      <Field id={`reply-${reviewId}`} as="textarea" rows={3} label={t("Javobingiz")} value={reply} onChange={(e) => setReply(e.target.value)} error={fe("reply")} />
      {error && <Alert variant="error">{error}</Alert>}
      <Button type="submit" size="sm" loading={loading}>{t("Javobni yuborish")}</Button>
    </form>
  );
}
