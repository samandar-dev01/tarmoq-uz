"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Field } from "@/components/ui/Field";
import { useHydrated } from "@/components/ui/useHydrated";
import { authHref, FLASH_KEY, type EntryRole } from "@/lib/authRole";

const ROLE_HOME = { CLIENT: "/dashboard/client", PROVIDER: "/dashboard/provider", ADMIN: "/admin" } as const;


// What a signed-in account is told when it came in through the other role's entry.
const OTHER_ROLE_NOTICE = { CLIENT: "Siz mijoz hisobi bilan kirdingiz", PROVIDER: "Siz ijodkor hisobi bilan kirdingiz" } as const;

export function LoginForm({ role, next }: { role: EntryRole; next: string | null }) {
  const router = useRouter();
  const ready = useHydrated();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const data = await res.json();
      if (res.status === 429) {
        // The server answers a blocked attempt with the same body as a wrong password; the status tells us.
        const minutes = Math.max(1, Math.ceil(Number(res.headers.get("Retry-After") ?? 60) / 60));
        setError(`Urinishlar juda koʻp. ${minutes} daqiqadan keyin qayta urinib koʻring.`);
        return;
      }
      if (!res.ok) {
        setFieldErrors(data.fieldErrors ?? {});
        setError(data.error ?? "Kirib boʻlmadi.");
        return;
      }
      const actual = data.user.role as keyof typeof ROLE_HOME;
      const expected = role === "provider" ? "PROVIDER" : "CLIENT";
      if (actual !== "ADMIN" && actual !== expected) {
        // The account belongs to the other role: sign in anyway, say so, and go to that role's own home
        // (`next` was meant for the role they picked, so it is dropped).
        try {
          window.sessionStorage.setItem(FLASH_KEY, OTHER_ROLE_NOTICE[actual]);
        } catch {
          // No storage: the redirect still lands them in the right place.
        }
        router.replace(ROLE_HOME[actual]);
      } else {
        router.replace(next ?? ROLE_HOME[actual]);
      }
      router.refresh();
    } catch {
      setError("Internet aloqasida muammo. Aloqani tekshirib, qayta urinib koʻring.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error && <Alert variant="error">{error}</Alert>}
      <Field label="Email" name="email" type="email" autoComplete="email" required error={fieldErrors.email?.[0]} />
      <Field label="Parol" name="password" type="password" autoComplete="current-password" required error={fieldErrors.password?.[0]} />
      <Button type="submit" size="lg" loading={loading} disabled={!ready} className="w-full">
        {loading ? "Kirilmoqda…" : "Kirish"}
      </Button>
      <p className="text-center text-ink-soft">
        Yangimisiz? <ButtonLink href={authHref("/register", role, next)} variant="link">Roʻyxatdan oʻting</ButtonLink>
      </p>
    </form>
  );
}
