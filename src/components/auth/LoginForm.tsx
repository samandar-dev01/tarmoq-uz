"use client";
import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Field } from "@/components/ui/Field";
import { useHydrated } from "@/components/ui/useHydrated";
import { safeNext } from "@/lib/safeNext";

const ROLE_HOME = { CLIENT: "/dashboard/client", PROVIDER: "/dashboard/provider", ADMIN: "/admin" } as const;


export function LoginForm() {
  const router = useRouter();
  const ready = useHydrated();
  const params = useSearchParams();
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
      if (!res.ok) {
        setFieldErrors(data.fieldErrors ?? {});
        setError(data.error ?? "Kirib boʻlmadi.");
        return;
      }
      router.replace(safeNext(params.get("next")) ?? ROLE_HOME[data.user.role as keyof typeof ROLE_HOME]);
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
        Yangimisiz? <ButtonLink href="/register" variant="link">Roʻyxatdan oʻting</ButtonLink>
      </p>
    </form>
  );
}
