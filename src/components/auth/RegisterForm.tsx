"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

type Role = "CLIENT" | "PROVIDER";

export function RegisterForm() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("CLIENT");
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
        setError(data.error ?? "Could not create your account.");
        return;
      }
      router.replace(role === "PROVIDER" ? "/dashboard/provider/profile/wizard" : "/search");
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
      <div role="radiogroup" aria-label="Account type" className="grid grid-cols-2 gap-2">
        {(["CLIENT", "PROVIDER"] as Role[]).map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={role === r}
            onClick={() => setRole(r)}
            className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${
              role === r ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-300 bg-white"
            }`}
          >
            {r === "CLIENT" ? "I want to hire" : "I offer services"}
          </button>
        ))}
      </div>
      <Field label="Full name" name="name" autoComplete="name" required error={fieldErrors.name?.[0]} />
      <Field label="Email" name="email" type="email" autoComplete="email" required error={fieldErrors.email?.[0]} />
      <Field label="Phone (optional)" name="phone" type="tel" autoComplete="tel" placeholder="+998 90 123 45 67" error={fieldErrors.phone?.[0]} />
      <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} error={fieldErrors.password?.[0]} />
      <Button type="submit" loading={loading} className="w-full">
        {loading ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-slate-600">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
