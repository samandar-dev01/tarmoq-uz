"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { CITIES, LANGUAGES } from "@/lib/constants";
import { useHydrated } from "@/components/ui/useHydrated";
import { formatUZS } from "@/lib/format";

type Status = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "SUSPENDED";
type ServiceRow = { id?: string; title: string; description: string; price: string; deliveryDays: string; revisions: string };
type ItemRow = { title: string; videoUrl: string; imageUrl: string };
type Issue = { path: string; message: string };
type ApiService = { id: string; title: string; description: string; price: number; deliveryDays: number; revisions: number };

export type WizardInitial = {
  slug: string; status: Status; wizardStep: number;
  headline: string; bio: string; categoryId: string;
  city: string; district: string; equipment: string; languages: string[];
  services: ApiService[];
  portfolio: { title: string; videoUrl: string | null; imageUrl: string | null }[];
} | null;

const STEPS = ["Asosiy", "Joylashuv", "Paketlar", "Portfolio", "Tekshirish"];
const blankService = (): ServiceRow => ({ title: "", description: "", price: "", deliveryDays: "3", revisions: "1" });
const blankItem = (): ItemRow => ({ title: "", videoUrl: "", imageUrl: "" });
const toRows = (s: ApiService[]): ServiceRow[] =>
  s.map((x) => ({ id: x.id, title: x.title, description: x.description, price: String(x.price), deliveryDays: String(x.deliveryDays), revisions: String(x.revisions) }));

export function ProfileWizard({ initial, categories }: { initial: WizardInitial; categories: { id: string; name: string }[] }) {
  const ready = useHydrated();
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

  async function save(stepNo: number, data?: unknown): Promise<boolean> {
    setSaving(true); setError(null); setIssues([]); setNotice(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: stepNo, data }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Saqlab boʻlmadi."); setIssues(json.issues ?? []); return false; }
      setMeta({ slug: json.profile.slug, status: json.profile.status, wizardStep: json.profile.wizardStep });
      if (stepNo === 3) setServices(toRows(json.profile.services)); // pick up new ids so re-saving doesn't duplicate
      return true;
    } catch {
      setError("Internet aloqasida muammo. Aloqani tekshirib, qayta urinib koʻring.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  const next = async (e: FormEvent, stepNo: number, data: unknown) => {
    e.preventDefault();
    if (await save(stepNo, data)) { setStep(stepNo + 1); setNotice("Saqlandi."); }
  };

  const submit = async () => {
    if (await save(5)) setNotice("Tekshiruvga yuborildi.");
  };

  const nav = (children: ReactNode) => (
    <div className="mt-8 flex items-center justify-between gap-3">
      {step > 1 ? <Button type="button" variant="secondary" onClick={() => { setError(null); setIssues([]); setStep(step - 1); }}>Orqaga</Button> : <span />}
      {children}
    </div>
  );

  return (
    <div>
      <ol className="mb-6 grid grid-cols-5 gap-2 text-center text-sm">
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
                className={`min-h-12 w-full rounded-ctl border-2 px-1 py-2 font-bold transition-colors ${
                  n === step
                    ? "border-ink bg-cobalt text-white shadow-pop-sm"
                    : reachable
                      ? "border-ink bg-white hover:bg-paper-deep"
                      : "border-ink/20 bg-paper-deep/60 text-ink-mute"
                }`}
              >
                <span className="hidden sm:inline">{n}. </span>{label}
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
              <Field label="Sarlavha" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Masalan: reels, tadbirlar va toʻylar uchun mobilograf" error={fe("headline")} />
              <Field as="textarea" label="Oʻzingiz haqingizda" rows={6} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tajribangiz, uslubingiz va mijozlar nimani kutishi mumkin." error={fe("bio")} />
              <Field as="select" label="Yoʻnalish" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} error={fe("categoryId")}>
                <option value="">Tanlang…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Field>
            </div>
            {nav(<Button type="submit" loading={saving} disabled={!ready}>Saqlash va davom etish</Button>)}
          </form>
        )}

        {step === 2 && (
          <form onSubmit={(e) => next(e, 2, { city, district, equipment, languages })} noValidate>
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field as="select" label="Shahar" value={city} onChange={(e) => setCity(e.target.value)}>
                  {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Field>
                <Field label="Tuman (ixtiyoriy)" value={district} onChange={(e) => setDistrict(e.target.value)} error={fe("district")} />
              </div>
              <Field label="Jihozlar (ixtiyoriy)" value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="Masalan: iPhone 15 Pro, gimbal, simsiz mikrofonlar" error={fe("equipment")} />
              <fieldset>
                <legend className="mb-1.5 text-sm font-bold">Qaysi tillarda ishlaysiz?</legend>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((l) => (
                    <label key={l} className="flex cursor-pointer items-center gap-2 rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-semibold has-[:checked]:bg-saffron">
                      <input type="checkbox" checked={languages.includes(l)} onChange={(e) => setLanguages(e.target.checked ? [...languages, l] : languages.filter((x) => x !== l))} />
                      {l}
                    </label>
                  ))}
                </div>
                {fe("languages") && <p className="mt-1.5 text-sm font-semibold text-pomegranate-deep">{fe("languages")}</p>}
              </fieldset>
            </div>
            {nav(<Button type="submit" loading={saving} disabled={!ready}>Saqlash va davom etish</Button>)}
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
                })),
              })
            }
            noValidate
          >
            {fe("services") && <p className="mb-4 text-sm font-semibold text-pomegranate-deep">{fe("services")}</p>}
            <div className="space-y-5">
              {services.map((s, i) => {
                const set = (patch: Partial<ServiceRow>) => setServices(services.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <Card key={s.id ?? i} tone="tint" padding="md">
                    <div className="mb-4 flex items-center justify-between">
                      <h3>{i + 1}-paket</h3>
                      {services.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setServices(services.filter((_, j) => j !== i))}>Oʻchirish</Button>
                      )}
                    </div>
                    <div className="space-y-4">
                      <Field label="Nomi" value={s.title} onChange={(e) => set({ title: e.target.value })} error={fe(`services.${i}.title`)} />
                      <Field as="textarea" label="Nimalar kiradi?" rows={3} value={s.description} onChange={(e) => set({ description: e.target.value })} error={fe(`services.${i}.description`)} />
                      <div className="grid gap-4 sm:grid-cols-3">
                        <Field label="Narx (soʻm)" type="number" inputMode="numeric" min={0} step={10000} value={s.price} onChange={(e) => set({ price: e.target.value })} error={fe(`services.${i}.price`)} />
                        <Field label="Muddat (kun)" type="number" inputMode="numeric" min={1} value={s.deliveryDays} onChange={(e) => set({ deliveryDays: e.target.value })} error={fe(`services.${i}.deliveryDays`)} />
                        <Field label="Tuzatishlar" type="number" inputMode="numeric" min={0} value={s.revisions} onChange={(e) => set({ revisions: e.target.value })} error={fe(`services.${i}.revisions`)} />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
            {services.length < 6 && (
              <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => setServices([...services, blankService()])}>+ Yana paket qoʻshish</Button>
            )}
            {nav(<Button type="submit" loading={saving} disabled={!ready}>Saqlash va davom etish</Button>)}
          </form>
        )}

        {step === 4 && (
          <form onSubmit={(e) => next(e, 4, { items })} noValidate>
            <p className="mb-4 text-ink-soft">Eng yaxshi ishlaringizga havola qoʻying (YouTube, Instagram, Google Drive yoki rasm). Havolalar https:// bilan boshlanishi kerak.</p>
            {fe("items") && <p className="mb-4 text-sm font-semibold text-pomegranate-deep">{fe("items")}</p>}
            <div className="space-y-5">
              {items.map((it, i) => {
                const set = (patch: Partial<ItemRow>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <Card key={i} tone="tint" padding="md">
                    <div className="mb-4 flex items-center justify-between">
                      <h3>{i + 1}-ish</h3>
                      {items.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setItems(items.filter((_, j) => j !== i))}>Oʻchirish</Button>}
                    </div>
                    <div className="space-y-4">
                      <Field label="Nomi" value={it.title} onChange={(e) => set({ title: e.target.value })} error={fe(`items.${i}.title`)} />
                      <Field label="Video havola" type="url" value={it.videoUrl} onChange={(e) => set({ videoUrl: e.target.value })} placeholder="https://" error={fe(`items.${i}.videoUrl`)} />
                      <Field label="Rasm havolasi (ixtiyoriy)" type="url" value={it.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} placeholder="https://" error={fe(`items.${i}.imageUrl`)} />
                    </div>
                  </Card>
                );
              })}
            </div>
            {items.length < 8 && (
              <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => setItems([...items, blankItem()])}>+ Yana ish qoʻshish</Button>
            )}
            {nav(<Button type="submit" loading={saving} disabled={!ready}>Saqlash va davom etish</Button>)}
          </form>
        )}

        {step === 5 && (
          <div>
            <h2>Profilni tekshiring</h2>
            <dl className="mt-5 space-y-4">
              <div><dt className="text-sm font-semibold text-ink-soft">Sarlavha</dt><dd>{headline}</dd></div>
              <div><dt className="text-sm font-semibold text-ink-soft">Joylashuv</dt><dd>{city}{district ? `, ${district}` : ""}</dd></div>
              <div><dt className="text-sm font-semibold text-ink-soft">Tillar</dt><dd>{languages.join(", ") || "—"}</dd></div>
              <div>
                <dt className="text-sm font-semibold text-ink-soft">Paketlar</dt>
                <dd>
                  <ul className="list-disc pl-5">
                    {services.map((s, i) => <li key={s.id ?? i}>{s.title}: {s.price ? formatUZS(Number(s.price)) : "—"}</li>)}
                  </ul>
                </dd>
              </div>
              <div><dt className="text-sm font-semibold text-ink-soft">Portfolio ishlari</dt><dd>{items.filter((i) => i.title).length} ta</dd></div>
            </dl>

            <div className="mt-6">
              {meta.status === "DRAFT" && <Alert variant="info">Yuborganingizdan keyin admin profilingizni tekshiradi, shundan soʻng u qidiruvda koʻrinadi.</Alert>}
              {meta.status === "PENDING_REVIEW" && <Alert variant="info">Yuborildi. Admin profilingizni tekshirmoqda. Tasdiqlangach, qidiruvda koʻrinasiz.</Alert>}
              {meta.status === "APPROVED" && (
                <Alert variant="success">
                  Profilingiz faol. {meta.slug && <ButtonLink href={`/providers/${meta.slug}`} variant="link">Ommaviy profilni koʻrish</ButtonLink>}
                </Alert>
              )}
            </div>
            {nav(meta.status === "DRAFT" ? <Button type="button" loading={saving} onClick={submit}>Tekshiruvga yuborish</Button> : <span />)}
          </div>
        )}
      </Card>
    </div>
  );
}
