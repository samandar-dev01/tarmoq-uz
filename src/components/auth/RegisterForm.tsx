"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Field } from "@/components/ui/Field";
import { useHydrated } from "@/components/ui/useHydrated";
import { useT } from "@/i18n/client";
import { tk } from "@/i18n/dictionary";
import { authHref, type EntryRole } from "@/lib/authRole";

type Role = "CLIENT" | "PROVIDER";

const ROLES: { value: Role; title: string; hint: string }[] = [
  { value: "CLIENT", title: tk("Buyurtma bermoqchiman"), hint: tk("Ijodkor topib, video buyurtma qilaman") },
  { value: "PROVIDER", title: tk("Ijodkorman"), hint: tk("Xizmatlarimni taklif qilaman") },
];

// `googleEnabled` is false until the owner has set the Google keys, so no button shows that could not work.
export function RegisterForm({ initialRole, next, googleEnabled = false }: { initialRole: EntryRole; next: string | null; googleEnabled?: boolean }) {
  const router = useRouter();
  const ready = useHydrated();
  const t = useT();
  const [role, setRole] = useState<Role>(initialRole === "provider" ? "PROVIDER" : "CLIENT");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.get("name"),
          email: f.get("email"),
          phone: f.get("phone"),
          password: f.get("password"),
          role,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFieldErrors(data.fieldErrors ?? (data.details?.field ? { [data.details.field]: [data.error] } : {}));
        setError(data.error ?? t("Hisob yaratib boʻlmadi."));
        return;
      }
      // `next` (already checked on the server) is a client destination, such as the package they wanted to order.
      router.replace(role === "PROVIDER" ? "/dashboard/provider/profile/wizard" : next ?? "/search");
      router.refresh();
    } catch {
      setError(t("Internet aloqasida muammo. Aloqani tekshirib, qayta urinib koʻring."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error && <Alert variant="error">{error}</Alert>}
      <div role="radiogroup" aria-label={t("Hisob turi")} className="grid gap-3">
        {ROLES.map((r) => {
          const selected = role === r.value;
          return (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setRole(r.value)}
              className={`rounded-card border p-4 text-left transition-[transform,box-shadow,background-color,border-color] duration-200 ease-snap ${
                selected ? "border-transparent bg-cobalt text-on-accent shadow-lift-sm" : "border-line-strong bg-surface hover:bg-paper-deep"
              }`}
            >
              <span className="block font-bold">{t(r.title)}</span>
              <span className={`mt-1 block text-sm ${selected ? "text-on-accent" : "text-ink-soft"}`}>{t(r.hint)}</span>
            </button>
          );
        })}
      </div>
      {/* Google first, under the account type (which decides what kind of account Google makes), then "or" and the email form. */}
      {googleEnabled && <GoogleButton door={role === "PROVIDER" ? "provider" : "client"} next={next} />}
      <Field label={t("Ism-familiya")} name="name" autoComplete="name" required error={fieldErrors.name?.[0]} />
      <Field label={t("Email")} name="email" type="email" autoComplete="email" required error={fieldErrors.email?.[0]} />
      <Field label={t("Telefon (ixtiyoriy)")} name="phone" type="tel" autoComplete="tel" placeholder="+998 90 123 45 67" error={fieldErrors.phone?.[0]} />
      <Field label={t("Parol")} name="password" type="password" autoComplete="new-password" required minLength={8} hint={t("Kamida 8 ta belgi")} error={fieldErrors.password?.[0]} />
      <Button type="submit" size="lg" loading={loading} disabled={!ready} className="w-full">
        {loading ? t("Yaratilmoqda…") : t("Roʻyxatdan oʻtish")}
      </Button>
      <p className="text-center text-ink-soft">
        {t("Hisobingiz bormi?")} <ButtonLink href={authHref("/login", role === "PROVIDER" ? "provider" : "client", next)} variant="link">{t("Kiring")}</ButtonLink>
      </p>
    </form>
  );
}
