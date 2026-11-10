"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { CITIES, LANGUAGES } from "@/lib/constants";
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

const STEPS = ["Basics", "Location", "Packages", "Portfolio", "Review"];
const box = "w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500";
const blankService = (): ServiceRow => ({ title: "", description: "", price: "", deliveryDays: "3", revisions: "1" });
const blankItem = (): ItemRow => ({ title: "", videoUrl: "", imageUrl: "" });
const toRows = (s: ApiService[]): ServiceRow[] =>
  s.map((x) => ({ id: x.id, title: x.title, description: x.description, price: String(x.price), deliveryDays: String(x.deliveryDays), revisions: String(x.revisions) }));

export function ProfileWizard({ initial, categories }: { initial: WizardInitial; categories: { id: string; name: string }[] }) {
  const [meta, setMeta] = useState({ slug: initial?.slug ?? null as string | null, status: (initial?.status ?? "DRAFT") as Status, wizardStep: initial?.wizardStep ?? 1 });
  const [step, setStep] = useState(initial && initial.status === "DRAFT" ? Math.min(initial.wizardStep, 5) : 1);

  const [headline, setHeadline] = useState(initial?.headline ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [city, setCity] = useState(initial?.city ?? "Andijan");
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
      if (!res.ok) { setError(json.error ?? "Could not save."); setIssues(json.issues ?? []); return false; }
      setMeta({ slug: json.profile.slug, status: json.profile.status, wizardStep: json.profile.wizardStep });
      if (stepNo === 3) setServices(toRows(json.profile.services)); // pick up new ids so re-saving doesn't duplicate
      return true;
    } catch {
      setError("Network error. Check your connection and try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  const next = async (e: FormEvent, stepNo: number, data: unknown) => {
    e.preventDefault();
    if (await save(stepNo, data)) { setStep(stepNo + 1); setNotice("Saved."); }
  };

  const submit = async () => {
    if (await save(5)) setNotice("Submitted for review.");
  };

  const nav = (children: ReactNode) => (
    <div className="mt-6 flex items-center justify-between">
      {step > 1 ? <Button type="button" variant="secondary" onClick={() => { setError(null); setIssues([]); setStep(step - 1); }}>Back</Button> : <span />}
      {children}
    </div>
  );

  return (
    <div>
      <ol className="mb-6 grid grid-cols-5 gap-1 text-center text-xs">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const reachable = n <= meta.wizardStep;
          return (
            <li key={label}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => { setError(null); setIssues([]); setStep(n); }}
                className={`w-full rounded-lg px-1 py-2 font-medium ${n === step ? "bg-indigo-600 text-white" : reachable ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-400"}`}
              >
                <span className="hidden sm:inline">{n}. </span>{label}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {error && <div className="mb-4"><Alert variant="error">{error}</Alert></div>}
        {notice && !error && <div className="mb-4"><Alert variant="success">{notice}</Alert></div>}

        {step === 1 && (
          <form onSubmit={(e) => next(e, 1, { headline, bio, categoryId })} noValidate>
            <div className="space-y-4">
              <Field label="Headline" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Mobile videographer: reels, events and weddings" error={fe("headline")} />
              <div>
                <label htmlFor="bio" className="mb-1 block text-sm font-medium text-slate-700">About you</label>
                <textarea id="bio" rows={6} value={bio} onChange={(e) => setBio(e.target.value)} className={`${box} ${fe("bio") ? "border-red-500" : "border-slate-300"}`} placeholder="Your experience, style, and what clients can expect." />
                {fe("bio") && <p className="mt-1 text-xs text-red-600">{fe("bio")}</p>}
              </div>
              <div>
                <label htmlFor="category" className="mb-1 block text-sm font-medium text-slate-700">Category</label>
                <select id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${box} ${fe("categoryId") ? "border-red-500" : "border-slate-300"}`}>
                  <option value="">Choose…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {fe("categoryId") && <p className="mt-1 text-xs text-red-600">{fe("categoryId")}</p>}
              </div>
            </div>
            {nav(<Button type="submit" loading={saving}>Save & continue</Button>)}
          </form>
        )}

        {step === 2 && (
          <form onSubmit={(e) => next(e, 2, { city, district, equipment, languages })} noValidate>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="city" className="mb-1 block text-sm font-medium text-slate-700">City</label>
                  <select id="city" value={city} onChange={(e) => setCity(e.target.value)} className={`${box} border-slate-300`}>
                    {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <Field label="District (optional)" value={district} onChange={(e) => setDistrict(e.target.value)} error={fe("district")} />
              </div>
              <Field label="Equipment (optional)" value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="e.g. iPhone 15 Pro, gimbal, wireless mics" error={fe("equipment")} />
              <fieldset>
                <legend className="mb-1 text-sm font-medium text-slate-700">Languages you work in</legend>
                <div className="flex flex-wrap gap-3">
                  {LANGUAGES.map((l) => (
                    <label key={l} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={languages.includes(l)} onChange={(e) => setLanguages(e.target.checked ? [...languages, l] : languages.filter((x) => x !== l))} />
                      {l}
                    </label>
                  ))}
                </div>
                {fe("languages") && <p className="mt-1 text-xs text-red-600">{fe("languages")}</p>}
              </fieldset>
            </div>
            {nav(<Button type="submit" loading={saving}>Save & continue</Button>)}
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
            {fe("services") && <p className="mb-3 text-sm text-red-600">{fe("services")}</p>}
            <div className="space-y-4">
              {services.map((s, i) => {
                const set = (patch: Partial<ServiceRow>) => setServices(services.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <div key={s.id ?? i} className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Package {i + 1}</h3>
                      {services.length > 1 && (
                        <button type="button" onClick={() => setServices(services.filter((_, j) => j !== i))} className="text-xs font-medium text-red-600 hover:underline">Remove</button>
                      )}
                    </div>
                    <div className="space-y-3">
                      <Field label="Title" value={s.title} onChange={(e) => set({ title: e.target.value })} error={fe(`services.${i}.title`)} />
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">What’s included</label>
                        <textarea rows={3} value={s.description} onChange={(e) => set({ description: e.target.value })} className={`${box} ${fe(`services.${i}.description`) ? "border-red-500" : "border-slate-300"}`} />
                        {fe(`services.${i}.description`) && <p className="mt-1 text-xs text-red-600">{fe(`services.${i}.description`)}</p>}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Price (UZS)" type="number" inputMode="numeric" min={0} step={10000} value={s.price} onChange={(e) => set({ price: e.target.value })} error={fe(`services.${i}.price`)} />
                        <Field label="Delivery (days)" type="number" inputMode="numeric" min={1} value={s.deliveryDays} onChange={(e) => set({ deliveryDays: e.target.value })} error={fe(`services.${i}.deliveryDays`)} />
                        <Field label="Revisions" type="number" inputMode="numeric" min={0} value={s.revisions} onChange={(e) => set({ revisions: e.target.value })} error={fe(`services.${i}.revisions`)} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {services.length < 6 && (
              <button type="button" onClick={() => setServices([...services, blankService()])} className="mt-3 text-sm font-medium text-indigo-600 hover:underline">+ Add another package</button>
            )}
            {nav(<Button type="submit" loading={saving}>Save & continue</Button>)}
          </form>
        )}

        {step === 4 && (
          <form onSubmit={(e) => next(e, 4, { items })} noValidate>
            <p className="mb-3 text-sm text-slate-600">Link to your best work (YouTube, Instagram, Google Drive, or an image). Links must start with https://.</p>
            {fe("items") && <p className="mb-3 text-sm text-red-600">{fe("items")}</p>}
            <div className="space-y-4">
              {items.map((it, i) => {
                const set = (patch: Partial<ItemRow>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <div key={i} className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Item {i + 1}</h3>
                      {items.length > 1 && <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-xs font-medium text-red-600 hover:underline">Remove</button>}
                    </div>
                    <div className="space-y-3">
                      <Field label="Title" value={it.title} onChange={(e) => set({ title: e.target.value })} error={fe(`items.${i}.title`)} />
                      <Field label="Video link" type="url" value={it.videoUrl} onChange={(e) => set({ videoUrl: e.target.value })} placeholder="https://" error={fe(`items.${i}.videoUrl`)} />
                      <Field label="Image link (optional)" type="url" value={it.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} placeholder="https://" error={fe(`items.${i}.imageUrl`)} />
                    </div>
                  </div>
                );
              })}
            </div>
            {items.length < 8 && (
              <button type="button" onClick={() => setItems([...items, blankItem()])} className="mt-3 text-sm font-medium text-indigo-600 hover:underline">+ Add another item</button>
            )}
            {nav(<Button type="submit" loading={saving}>Save & continue</Button>)}
          </form>
        )}

        {step === 5 && (
          <div>
            <h2 className="text-lg font-semibold">Review your profile</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="font-medium text-slate-500">Headline</dt><dd>{headline}</dd></div>
              <div><dt className="font-medium text-slate-500">Location</dt><dd>{city}{district ? `, ${district}` : ""}</dd></div>
              <div><dt className="font-medium text-slate-500">Languages</dt><dd>{languages.join(", ") || "—"}</dd></div>
              <div>
                <dt className="font-medium text-slate-500">Packages</dt>
                <dd>
                  <ul className="list-disc pl-5">
                    {services.map((s, i) => <li key={s.id ?? i}>{s.title}: {s.price ? formatUZS(Number(s.price)) : "—"}</li>)}
                  </ul>
                </dd>
              </div>
              <div><dt className="font-medium text-slate-500">Portfolio items</dt><dd>{items.filter((i) => i.title).length}</dd></div>
            </dl>

            <div className="mt-5">
              {meta.status === "DRAFT" && <Alert variant="info">When you submit, an admin reviews your profile before it appears in search.</Alert>}
              {meta.status === "PENDING_REVIEW" && <Alert variant="info">Submitted. An admin is reviewing your profile. You’ll be visible in search once it’s approved.</Alert>}
              {meta.status === "APPROVED" && (
                <Alert variant="success">
                  Your profile is live. {meta.slug && <Link href={`/providers/${meta.slug}`} className="font-medium underline">View public profile</Link>}
                </Alert>
              )}
            </div>
            {nav(meta.status === "DRAFT" ? <Button type="button" loading={saving} onClick={submit}>Submit for review</Button> : <span />)}
          </div>
        )}
      </div>
    </div>
  );
}
