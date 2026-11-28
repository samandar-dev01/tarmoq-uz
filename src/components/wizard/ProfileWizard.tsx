"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { CITIES, LANGUAGES, categoryName, labelFor } from "@/lib/constants";
import { useHydrated } from "@/components/ui/useHydrated";
import { useLocale, useT } from "@/i18n/client";
import { tk } from "@/i18n/dictionary";
import { formatUZS } from "@/lib/format";
import { catalogName, findCategory } from "@/lib/catalog";
import { MAX_FAQ, type Faq } from "@/lib/serviceDetails";

type Status = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "SUSPENDED";
type ServiceRow = { id?: string; title: string; description: string; price: string; deliveryDays: string; revisions: string; subcategory: string; questions: string; faq: Faq[] };
type ItemRow = { title: string; videoUrl: string; imageUrl: string };
type Issue = { path: string; message: string };
type ApiService = { id: string; title: string; description: string; price: number; deliveryDays: number; revisions: number; subcategory: string | null; questions: string[] | null; faq: Faq[] };

export type WizardInitial = {
  slug: string; status: Status; wizardStep: number;
  headline: string; bio: string; categoryId: string;
  city: string; district: string; equipment: string; languages: string[];
  services: ApiService[];
  portfolio: { title: string; videoUrl: string | null; imageUrl: string | null }[];
} | null;

const STEPS = [tk("Asosiy"), tk("Joylashuv"), tk("Paketlar"), tk("Portfolio"), tk("Tekshirish")];
const blankService = (): ServiceRow => ({ title: "", description: "", price: "", deliveryDays: "3", revisions: "1", subcategory: "", questions: "", faq: [] });
// The questions are written one per line; empty lines are not questions.
const lines = (text: string) => text.split("\n").map((x) => x.trim()).filter(Boolean);
const blankItem = (): ItemRow => ({ title: "", videoUrl: "", imageUrl: "" });
const toRows = (s: ApiService[]): ServiceRow[] =>
  s.map((x) => ({
    id: x.id, title: x.title, description: x.description, price: String(x.price), deliveryDays: String(x.deliveryDays), revisions: String(x.revisions),
    subcategory: x.subcategory ?? "", questions: (x.questions ?? []).join("\n"), faq: x.faq,
  }));

export function ProfileWizard({ initial, categories }: { initial: WizardInitial; categories: { id: string; slug: string; name: string; nameRu: string | null }[] }) {
  const ready = useHydrated();
  const t = useT();
  const locale = useLocale();
  // The page hands the categories over in the order of their Uzbek names; a Russian reader finds them in Russian alphabetical order.
  // (Compared by code point, not with `Intl`, so the server and the browser always agree.)
  const categoryOptions = locale === "ru" ? [...categories].sort((a, b) => (categoryName(locale, a) < categoryName(locale, b) ? -1 : 1)) : categories;
  const [meta, setMeta] = useState({ slug: initial?.slug ?? null as string | null, status: (initial?.status ?? "DRAFT") as Status, wizardStep: initial?.wizardStep ?? 1 });
  const [step, setStep] = useState(initial && initial.status === "DRAFT" ? Math.min(initial.wizardStep, 5) : 1);

  const [headline, setHeadline] = useState(initial?.headline ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [city, setCity] = useState(initial?.city ?? "Andijon");
  const [district, setDistrict] = useState(initial?.district ?? "");
  const [equipment, setEquipment] = useState(initial?.equipment ?? "");
  const [languages, setLanguages] = useState<string[]>(initial?.languages ?? []);
  const [services, setServices] = useState<ServiceRow[]>(initial?.services.length ? toRows(initial.services) : [blankService()]);
  const [items, setItems] = useState<ItemRow[]>(
    initial?.portfolio.length ? initial.portfolio.map((i) => ({ title: i.title, videoUrl: i.videoUrl ?? "", imageUrl: i.imageUrl ?? "" })) : [blankItem()],
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const fe = (path: string) => issues.find((i) => i.path === path)?.message;
  // The first complaint about a field or about anything inside it (one question of the list, one answer).
  const under = (path: string) => issues.find((i) => i.path === path || i.path.startsWith(`${path}.`))?.message;
  const subcategories = findCategory(categories.find((c) => c.id === categoryId)?.slug)?.subcategories ?? [];

  async function save(stepNo: number, data?: unknown): Promise<boolean> {
    setSaving(true); setError(null); setIssues([]); setNotice(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: stepNo, data }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? t("Saqlab boʻlmadi.")); setIssues(json.issues ?? []); return false; }
      setMeta({ slug: json.profile.slug, status: json.profile.status, wizardStep: json.profile.wizardStep });
      if (stepNo === 3) setServices(toRows(json.profile.services)); // pick up new ids so re-saving doesn't duplicate
      return true;
    } catch {
      setError(t("Internet aloqasida muammo. Aloqani tekshirib, qayta urinib koʻring."));
      return false;
    } finally {
      setSaving(false);
    }
  }

  const next = async (e: FormEvent, stepNo: number, data: unknown) => {
    e.preventDefault();
    if (await save(stepNo, data)) { setStep(stepNo + 1); setNotice(t("Saqlandi.")); }
  };

  const submit = async () => {
    if (await save(5)) setNotice(t("Tekshiruvga yuborildi."));
  };

  const nav = (children: ReactNode) => (
    <div className="mt-8 flex items-center justify-between gap-3">
      {step > 1 ? <Button type="button" variant="secondary" onClick={() => { setError(null); setIssues([]); setStep(step - 1); }}>{t("Orqaga")}</Button> : <span />}
      {children}
    </div>
  );

  return (
    <div>
      <ol className={`mb-6 grid grid-cols-5 text-center ${locale === "ru" ? "gap-1 text-[0.6875rem] leading-tight sm:gap-2 sm:text-sm" : "gap-2 text-sm"}`}>
        {STEPS.map((label, i) => {
          const n = i + 1;
          const reachable = n <= meta.wizardStep;
          return (
            <li key={label}>
              <button
                type="button"
                disabled={!reachable}
                aria-current={n === step ? "step" : undefined}
                onClick={() => { setError(null); setIssues([]); setStep(n); }}
                className={`min-h-12 w-full rounded-ctl border py-2 font-bold transition-colors duration-150 ${locale === "ru" ? "px-0.5 sm:px-1" : "px-1"} ${
                  n === step
                    ? "border-transparent bg-cobalt text-on-accent shadow-lift-sm"
                    : reachable
                      ? "border-line-strong bg-surface hover:bg-paper-deep"
                      : "border-line bg-paper-deep/60 text-ink-mute"
                }`}
              >
                <span className="hidden sm:inline">{n}. </span>{t(label)}
              </button>
            </li>
          );
        })}
      </ol>

      <Card padding="lg">
        {error && <div className="mb-5"><Alert variant="error">{error}</Alert></div>}
        {notice && !error && <div className="mb-5"><Alert variant="success">{notice}</Alert></div>}

        {step === 1 && (
          <form onSubmit={(e) => next(e, 1, { headline, bio, categoryId })} noValidate>
            <div className="space-y-5">
              <Field label={t("Sarlavha")} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder={t("Masalan: reels, tadbirlar va toʻylar uchun mobilograf")} error={fe("headline")} />
              <Field as="textarea" label={t("Oʻzingiz haqingizda")} rows={6} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t("Tajribangiz, uslubingiz va mijozlar nimani kutishi mumkin.")} error={fe("bio")} />
              <Field as="select" label={t("Yoʻnalish")} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} error={fe("categoryId")}>
                <option value="">{t("Tanlang…")}</option>
                {categoryOptions.map((c) => <option key={c.id} value={c.id}>{categoryName(locale, c)}</option>)}
              </Field>
            </div>
            {nav(<Button type="submit" loading={saving} disabled={!ready}>{t("Saqlash va davom etish")}</Button>)}
          </form>
        )}

        {step === 2 && (
          <form onSubmit={(e) => next(e, 2, { city, district, equipment, languages })} noValidate>
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field as="select" label={t("Shahar")} value={city} onChange={(e) => setCity(e.target.value)}>
                  {CITIES.map((c) => <option key={c} value={c}>{labelFor(locale, c)}</option>)}
                </Field>
                <Field label={t("Tuman (ixtiyoriy)")} value={district} onChange={(e) => setDistrict(e.target.value)} error={fe("district")} />
              </div>
              <Field label={t("Jihozlar (ixtiyoriy)")} value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder={t("Masalan: iPhone 15 Pro, gimbal, simsiz mikrofonlar")} error={fe("equipment")} />
              <fieldset>
                <legend className="mb-1.5 text-sm font-bold">{t("Qaysi tillarda ishlaysiz?")}</legend>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((l) => (
                    <label key={l} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2 text-sm font-semibold transition-colors duration-150 has-[:checked]:border-transparent has-[:checked]:bg-saffron has-[:checked]:text-night">
                      <input type="checkbox" checked={languages.includes(l)} onChange={(e) => setLanguages(e.target.checked ? [...languages, l] : languages.filter((x) => x !== l))} />
                      {labelFor(locale, l)}
                    </label>
                  ))}
                </div>
                {fe("languages") && <p className="mt-1.5 text-sm font-semibold text-pomegranate-deep">{fe("languages")}</p>}
              </fieldset>
            </div>
            {nav(<Button type="submit" loading={saving} disabled={!ready}>{t("Saqlash va davom etish")}</Button>)}
          </form>
        )}

        {step === 3 && (
          <form
            onSubmit={(e) =>
              next(e, 3, {
                services: services.map((s) => ({
                  id: s.id, title: s.title, description: s.description,
                  price: s.price === "" ? undefined : Number(s.price),
                  deliveryDays: s.deliveryDays === "" ? undefined : Number(s.deliveryDays),
                  revisions: s.revisions === "" ? undefined : Number(s.revisions),
                  // A subdirection of a direction chosen earlier is not sent along with a new one.
                  subcategory: subcategories.some((x) => x.slug === s.subcategory) ? s.subcategory : "",
                  questions: lines(s.questions),
                  faq: s.faq.filter((f) => f.question.trim() || f.answer.trim()),
                })),
              })
            }
            noValidate
          >
            <p className="mb-4 text-ink-soft">{t("Paketni eʼlon qilish bilan siz uning shartlarida buyurtma qabul qilishga rozilik bildirasiz. Toʻlovgacha shartlarni oʻzgartirishni taklif qilishingiz mumkin.")}</p>
            {fe("services") && <p className="mb-4 text-sm font-semibold text-pomegranate-deep">{fe("services")}</p>}
            <div className="space-y-5">
              {services.map((s, i) => {
                const set = (patch: Partial<ServiceRow>) => setServices(services.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <Card key={s.id ?? i} tone="tint" padding="md">
                    <div className="mb-4 flex items-center justify-between">
                      <h3>{t("{n}-paket", { n: i + 1 })}</h3>
                      {services.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setServices(services.filter((_, j) => j !== i))}>{t("Oʻchirish")}</Button>
                      )}
                    </div>
                    <div className="space-y-4">
                      <Field label={t("Nomi")} value={s.title} onChange={(e) => set({ title: e.target.value })} error={fe(`services.${i}.title`)} />
                      <Field as="textarea" label={t("Nimalar kiradi?")} rows={3} value={s.description} onChange={(e) => set({ description: e.target.value })} error={fe(`services.${i}.description`)} />
                      <div className="grid gap-4 sm:grid-cols-3">
                        <Field label={t("Narx (soʻm)")} type="number" inputMode="numeric" min={0} step={10000} value={s.price} onChange={(e) => set({ price: e.target.value })} error={fe(`services.${i}.price`)} />
                        <Field label={t("Muddat (kun)")} type="number" inputMode="numeric" min={1} value={s.deliveryDays} onChange={(e) => set({ deliveryDays: e.target.value })} error={fe(`services.${i}.deliveryDays`)} />
                        <Field label={t("Tuzatishlar")} type="number" inputMode="numeric" min={0} value={s.revisions} onChange={(e) => set({ revisions: e.target.value })} error={fe(`services.${i}.revisions`)} />
                      </div>
                      <Field as="select" label={t("Ichki yoʻnalish (ixtiyoriy)")} value={s.subcategory} onChange={(e) => set({ subcategory: e.target.value })} error={fe(`services.${i}.subcategory`)}>
                        <option value="">{t("Tanlang…")}</option>
                        {subcategories.map((x) => <option key={x.slug} value={x.slug}>{catalogName(locale, x)}</option>)}
                      </Field>
                      <Field as="textarea" label={t("Mijozga savollar (ixtiyoriy)")} hint={t("Har bir savolni alohida qatorga yozing, koʻpi bilan 5 ta. Mijoz buyurtma berayotganda javob beradi.")} rows={3} value={s.questions} onChange={(e) => set({ questions: e.target.value })} error={under(`services.${i}.questions`)} />
                      <fieldset className="space-y-3">
                        <legend className="mb-1 text-sm font-bold">{t("Koʻp beriladigan savollar (ixtiyoriy)")}</legend>
                        {s.faq.map((f, k) => {
                          const setFaq = (patch: Partial<Faq>) => set({ faq: s.faq.map((x, j) => (j === k ? { ...x, ...patch } : x)) });
                          return (
                            <div key={k} className="space-y-3 border-l-2 border-line-strong pl-3">
                              <Field label={t("Savol")} value={f.question} onChange={(e) => setFaq({ question: e.target.value })} error={fe(`services.${i}.faq.${k}.question`)} />
                              <Field as="textarea" label={t("Javob")} rows={2} value={f.answer} onChange={(e) => setFaq({ answer: e.target.value })} error={fe(`services.${i}.faq.${k}.answer`)} />
                              <Button type="button" variant="ghost" size="sm" onClick={() => set({ faq: s.faq.filter((_, j) => j !== k) })}>{t("Savolni oʻchirish")}</Button>
                            </div>
                          );
                        })}
                        {s.faq.length < MAX_FAQ && (
                          <Button type="button" variant="secondary" size="sm" onClick={() => set({ faq: [...s.faq, { question: "", answer: "" }] })}>{t("+ Savol-javob qoʻshish")}</Button>
                        )}
                      </fieldset>
                    </div>
                  </Card>
                );
              })}
            </div>
            {services.length < 6 && (
              <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => setServices([...services, blankService()])}>{t("+ Yana paket qoʻshish")}</Button>
            )}
            {nav(<Button type="submit" loading={saving} disabled={!ready}>{t("Saqlash va davom etish")}</Button>)}
          </form>
        )}

        {step === 4 && (
          <form onSubmit={(e) => next(e, 4, { items })} noValidate>
            <p className="mb-4 text-ink-soft">{t("Eng yaxshi ishlaringizga havola qoʻying (YouTube, Instagram, Google Drive yoki rasm). Havolalar https:// bilan boshlanishi kerak.")}</p>
            {fe("items") && <p className="mb-4 text-sm font-semibold text-pomegranate-deep">{fe("items")}</p>}
            <div className="space-y-5">
              {items.map((it, i) => {
                const set = (patch: Partial<ItemRow>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <Card key={i} tone="tint" padding="md">
                    <div className="mb-4 flex items-center justify-between">
                      <h3>{t("{n}-ish", { n: i + 1 })}</h3>
                      {items.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setItems(items.filter((_, j) => j !== i))}>{t("Oʻchirish")}</Button>}
                    </div>
                    <div className="space-y-4">
                      <Field label={t("Nomi")} value={it.title} onChange={(e) => set({ title: e.target.value })} error={fe(`items.${i}.title`)} />
                      <Field label={t("Video havola")} type="url" value={it.videoUrl} onChange={(e) => set({ videoUrl: e.target.value })} placeholder="https://" error={fe(`items.${i}.videoUrl`)} />
                      <Field label={t("Rasm havolasi (ixtiyoriy)")} type="url" value={it.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} placeholder="https://" error={fe(`items.${i}.imageUrl`)} />
                    </div>
                  </Card>
                );
              })}
            </div>
            {items.length < 8 && (
              <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => setItems([...items, blankItem()])}>{t("+ Yana ish qoʻshish")}</Button>
            )}
            {nav(<Button type="submit" loading={saving} disabled={!ready}>{t("Saqlash va davom etish")}</Button>)}
          </form>
        )}

        {step === 5 && (
          <div>
            <h2>{t("Profilni tekshiring")}</h2>
            <dl className="mt-5 space-y-4">
              <div><dt className="text-sm font-semibold text-ink-soft">{t("Sarlavha")}</dt><dd data-user-content>{headline}</dd></div>
              <div><dt className="text-sm font-semibold text-ink-soft">{t("Joylashuv")}</dt><dd>{labelFor(locale, city)}{district ? <>, <span data-user-content>{district}</span></> : ""}</dd></div>
              <div><dt className="text-sm font-semibold text-ink-soft">{t("Tillar")}</dt><dd>{languages.map((l) => labelFor(locale, l)).join(", ") || "—"}</dd></div>
              <div>
                <dt className="text-sm font-semibold text-ink-soft">{t("Paketlar")}</dt>
                <dd>
                  <ul className="list-disc pl-5">
                    {services.map((s, i) => <li key={s.id ?? i}><span data-user-content>{s.title}</span>: {s.price ? formatUZS(Number(s.price), locale) : "—"}</li>)}
                  </ul>
                </dd>
              </div>
              <div><dt className="text-sm font-semibold text-ink-soft">{t("Portfolio ishlari")}</dt><dd>{t("{n} ta", { n: items.filter((i) => i.title).length })}</dd></div>
            </dl>

            <div className="mt-6">
              {meta.status === "DRAFT" && <Alert variant="info">{t("Yuborganingizdan keyin admin profilingizni tekshiradi, shundan soʻng u qidiruvda koʻrinadi.")}</Alert>}
              {meta.status === "PENDING_REVIEW" && <Alert variant="info">{t("Yuborildi. Admin profilingizni tekshirmoqda. Tasdiqlangach, qidiruvda koʻrinasiz.")}</Alert>}
              {meta.status === "APPROVED" && (
                <Alert variant="success">
                  {t("Profilingiz faol.")} {meta.slug && <ButtonLink href={`/providers/${meta.slug}`} variant="link">{t("Ommaviy profilni koʻrish")}</ButtonLink>}
                </Alert>
              )}
            </div>
            {nav(meta.status === "DRAFT" ? <Button type="button" loading={saving} onClick={submit}>{t("Tekshiruvga yuborish")}</Button> : <span />)}
          </div>
        )}
      </Card>
    </div>
  );
}
