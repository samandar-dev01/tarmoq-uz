"use client";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useHydrated } from "@/components/ui/useHydrated";
import { useT } from "@/i18n/client";
import { useAction } from "./useAction";

type Seen = { price: number; deliveryDays: number; revisions: number };

export function NewOrderForm({ serviceId, seen, questions = [], terms, termsRu = null }: { serviceId: string; seen: Seen; questions?: string[]; terms: string; termsRu?: string | null }) {
  const { run, loading, error, fe, router } = useAction();
  const t = useT();
  const ready = useHydrated();
  const [brief, setBrief] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));
  const [accepted, setAccepted] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await run("/api/orders", { json: { serviceId, brief, eventDate, answers, accept: true, seen } }, (data) => router.push(`/checkout/${data.order.id}`));
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
      {questions.map((question, i) => (
        // The creator's own words are the label.
        <Field key={i} as="textarea" label={question} rows={2} value={answers[i] ?? ""} onChange={(e) => setAnswers(answers.map((x, j) => (j === i ? e.target.value : x)))} error={fe(`answers.${i}`)} />
      ))}
      <Field label={t("Tadbir yoki syomka sanasi (ixtiyoriy)")} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} error={fe("eventDate")} />
      <details className="rounded-ctl border border-line-strong">
        <summary className="min-h-11 px-4 py-3 font-semibold">{t("Toʻliq shartlar matni")}</summary>
        {termsRu && (
          <>
            {/* A reading in Russian for information; the Uzbek text under it is the binding one. */}
            <p className="border-t border-line px-4 pt-3 text-sm font-semibold text-ink-soft">{t("Axborot uchun tarjima. Majburiy kuchga ega boʻlgan matn quyidagi oʻzbekcha matndir.")}</p>
            <pre className="whitespace-pre-wrap p-4 font-sans text-sm leading-6">{termsRu}</pre>
          </>
        )}
        {/* The binding text is Uzbek, whatever the page's language. */}
        <pre data-testid="agreement-uz" lang="uz" className="max-h-72 overflow-auto whitespace-pre-wrap border-t border-line p-4 font-sans text-sm leading-6">{terms}</pre>
      </details>
      <label className="flex cursor-pointer items-start gap-3 font-medium">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
        <span>{t("Shartlar bilan tanishib chiqdim va qabul qilaman")}</span>
      </label>
      <p className="text-sm text-ink-soft">{t("Keyingi sahifada toʻlaysiz. Toʻlashdan oldin siz ham, ijodkor ham shartlarni oʻzgartirishni taklif qilishingiz mumkin.")}</p>
      <Button type="submit" size="lg" loading={loading} disabled={!ready || !accepted} className="w-full sm:w-auto">{loading ? t("Yuborilmoqda…") : t("Sotib olish")}</Button>
    </form>
  );
}
