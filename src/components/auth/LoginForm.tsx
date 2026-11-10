"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

const ROLE_HOME = { CLIENT: "/dashboard/client", PROVIDER: "/dashboard/provider", ADMIN: "/admin" } as const;

// Only allow same-site relative paths (prevents open-redirect).
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : null);

export function LoginForm() {
  const router = useRouter();
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
        setError(data.error ?? "Could not sign in.");
        return;
      }
      router.replace(safeNext(params.get("next")) ?? ROLE_HOME[data.user.role as keyof typeof ROLE_HOME]);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert variant="error">{error}</Alert>}
      <Field label="Email" name="email" type="email" autoComplete="email" required error={fieldErrors.email?.[0]} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required error={fieldErrors.password?.[0]} />
      <Button type="submit" loading={loading} className="w-full">
        {loading ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-slate-600">
        New here?{" "}
        <Link href="/register" className="font-medium text-indigo-600 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
