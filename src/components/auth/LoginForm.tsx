"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Field } from "@/components/ui/Field";
import { useHydrated } from "@/components/ui/useHydrated";
import { useT } from "@/i18n/client";
import { tk } from "@/i18n/dictionary";
import { authHref, DOORS, type Door } from "@/lib/authRole";

const ROLE_HOME = { CLIENT: "/dashboard/client", PROVIDER: "/dashboard/provider", ADMIN: "/admin" } as const;

// The link shown when an account came to a door that is not its own.
const DOOR_LINK: Record<Door, string> = { client: tk("Mijoz sifatida kirish"), provider: tk("Ijodkor sifatida kirish"), admin: tk("Admin kirishi") };

// `at` is the door the error was raised at. This form stays mounted when the door changes (only the query does),
// so that the email typed survives; an error from the previous door must not follow the visitor to the next one.
// `info`: a notice that is not a failure (the person pressed Cancel on Google's screen).
type FormError = { at: Door; message: string; door?: Door; info?: boolean };

// `notice` is what the page found out before this form was shown: Google sent the person back here with a reason.
// `googleEnabled` is false until the owner has set the Google keys, so no button shows that could not work.
export function LoginForm({
  role,
  next,
  googleEnabled = false,
  notice = null,
}: {
  role: Door;
  next: string | null;
  googleEnabled?: boolean;
  notice?: { message: string; door?: Door; info?: boolean } | null;
}) {
  const router = useRouter();
  const ready = useHydrated();
  const t = useT();
  const [failure, setFailure] = useState<FormError | null>(notice ? { at: role, ...notice } : null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const error = failure?.at === role ? failure : null;
  const setError = (message: string, door?: Door) => setFailure({ at: role, message, door });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    setFailure(null);
    setFieldErrors({});
    setLoading(true);
    const form = new FormData(formEl);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password"), role }),
      });
      const data = await res.json();
      if (res.status === 429) {
        // The server answers a blocked attempt with the same body as a wrong password; the status tells us.
        const minutes = Math.max(1, Math.ceil(Number(res.headers.get("Retry-After") ?? 60) / 60));
        setError(t("Urinishlar juda koʻp. {minutes} daqiqadan keyin qayta urinib koʻring.", { minutes }));
        return;
      }
      if (!res.ok) {
        const door = data.details?.code === "WRONG_DOOR" ? DOORS.find((d) => d === data.details.door) : undefined;
        if (door) {
          // The password was right but this is not the account's door. Nothing was signed in: the email stays for
          // the right door, the password does not.
          const password = formEl.elements.namedItem("password");
          if (password instanceof HTMLInputElement) password.value = "";
        }
        setFieldErrors(data.fieldErrors ?? {});
        setError(data.error ?? t("Kirib boʻlmadi."), door);
        return;
      }
      router.replace(next ?? ROLE_HOME[data.user.role as keyof typeof ROLE_HOME]);
      router.refresh();
    } catch {
      setError(t("Internet aloqasida muammo. Aloqani tekshirib, qayta urinib koʻring."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error && (
        <Alert variant={error.info ? "info" : "error"}>
          {error.message}
          {error.door && (
            <>
              {" "}
              <ButtonLink href={authHref("/login", error.door, next)} variant="link" replace>{t(DOOR_LINK[error.door])}</ButtonLink>
            </>
          )}
        </Alert>
      )}
      {/* Google first (one tap, no password), then "or" and the email form. The admin door has no Google. */}
      {googleEnabled && role !== "admin" && <GoogleButton door={role} next={next} />}
      <Field label={t("Email")} name="email" type="email" autoComplete="email" required error={fieldErrors.email?.[0]} />
      <Field label={t("Parol")} name="password" type="password" autoComplete="current-password" required error={fieldErrors.password?.[0]} />
      <Button type="submit" size="lg" loading={loading} disabled={!ready} className="w-full">
        {loading ? t("Kirilmoqda…") : t("Kirish")}
      </Button>
      {role !== "admin" && (
        <p className="text-center text-ink-soft">
          {t("Yangimisiz?")} <ButtonLink href={authHref("/register", role, next)} variant="link">{t("Roʻyxatdan oʻting")}</ButtonLink>
        </p>
      )}
    </form>
  );
}
