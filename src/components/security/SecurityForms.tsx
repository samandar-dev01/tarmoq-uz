"use client";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Field } from "@/components/ui/Field";
import { useHydrated } from "@/components/ui/useHydrated";
import { useAction } from "@/components/orders/useAction";
import { useT } from "@/i18n/client";

/** Turning two-step sign-in on (password, then the app's code) or off. */
export function TwoFactorForm({ enabled }: { enabled: boolean }) {
  const { run, loading, error, fe } = useAction();
  const t = useT();
  const ready = useHydrated();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<{ secret: string; url: string } | null>(null);
  const post = (json: unknown, done?: (data: any) => void) => run("/api/account/two-factor", { json }, done);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (enabled) await post({ action: "disable", currentPassword: password, code }, () => { setPassword(""); setCode(""); });
    else if (!setup) await post({ action: "setup", currentPassword: password }, (data) => { setSetup(data); setPassword(""); });
    else await post({ action: "enable", code }, () => { setSetup(null); setCode(""); });
  };
  return (
    <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
      <p className="text-ink-soft">
        {enabled ? t("Yoqilgan: kirishda parol bilan birga ilovadagi 6 xonali kod soʻraladi.") : t("Parolga qoʻshimcha ravishda telefondagi autentifikator ilovasi (masalan, Google Authenticator) kodi soʻraladi.")}
      </p>
      {setup && (
        <div className="space-y-2 rounded-ctl border border-line-strong bg-paper-deep p-4">
          <p>{t("Ilovada yangi hisob qoʻshing va shu kalitni kiriting:")}</p>
          <p data-testid="totp-secret" className="break-all font-mono text-lg font-bold tracking-wider">{setup.secret}</p>
          <ButtonLink href={setup.url} variant="link" className="inline-flex min-h-11 items-center">{t("Telefonda ilovani ochish")}</ButtonLink>
        </div>
      )}
      {(enabled || !setup) && (
        <Field id="totp-password" label={t("Joriy parol")} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fe("currentPassword")} />
      )}
      {(enabled || setup) && (
        <Field id="totp-code" label={t("Ilovadagi kod")} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} error={fe("code")} />
      )}
      {error && <Alert variant="error">{error}</Alert>}
      <Button type="submit" variant={enabled ? "secondary" : "primary"} loading={loading} disabled={!ready}>
        {enabled ? t("Oʻchirish") : setup ? t("Yoqish") : t("Sozlashni boshlash")}
      </Button>
    </form>
  );
}

export function VerifyEmailAgain() {
  const { run, loading, error } = useAction();
  const t = useT();
  const ready = useHydrated();
  const [sent, setSent] = useState(false);
  return (
    <div className="mt-4 space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      {sent && !error && <Alert variant="success">{t("Xat yuborildi. Pochtangizni tekshiring.")}</Alert>}
      <Button type="button" variant="secondary" loading={loading} disabled={!ready} onClick={() => run("/api/account/verify", {}, () => setSent(true))}>{t("Tasdiqlash xatini yuborish")}</Button>
    </div>
  );
}

export function ForgotForm() {
  const { run, loading, error, fe } = useAction();
  const t = useT();
  const ready = useHydrated();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <form onSubmit={(e) => { e.preventDefault(); void run("/api/auth/forgot", { json: { email } }, () => setSent(true)); }} className="space-y-5" noValidate>
      <Field label={t("Email")} name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fe("email")} />
      {error && <Alert variant="error">{error}</Alert>}
      {sent && !error && <Alert variant="success">{t("Agar bu email bilan hisob boʻlsa, unga havola yuborildi.")}</Alert>}
      <Button type="submit" size="lg" loading={loading} disabled={!ready} className="w-full">{t("Havola yuborish")}</Button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const { run, loading, error, fe } = useAction();
  const t = useT();
  const ready = useHydrated();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <div className="space-y-4">
        <Alert variant="success">{t("Parol oʻzgartirildi. Endi yangi parol bilan kiring.")}</Alert>
        <ButtonLink href="/login?role=client" size="lg" className="w-full">{t("Kirish")}</ButtonLink>
      </div>
    );
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); void run("/api/auth/reset", { json: { token, password } }, () => setDone(true)); }} className="space-y-5" noValidate>
      <Field label={t("Yangi parol")} name="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fe("password")} />
      {error && <Alert variant="error">{error}</Alert>}
      <Button type="submit" size="lg" loading={loading} disabled={!ready} className="w-full">{t("Parolni oʻzgartirish")}</Button>
    </form>
  );
}

export function ConfirmEmail({ token }: { token: string }) {
  const { run, loading, error } = useAction();
  const t = useT();
  const ready = useHydrated();
  const [done, setDone] = useState(false);
  if (done) return <Alert variant="success">{t("Email tasdiqlandi. Rahmat!")}</Alert>;
  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      <Button type="button" size="lg" loading={loading} disabled={!ready} className="w-full" onClick={() => run("/api/auth/verify-email", { json: { token } }, () => setDone(true))}>{t("Emailni tasdiqlash")}</Button>
    </div>
  );
}
