"use client";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useHydrated } from "@/components/ui/useHydrated";
import { useAction } from "@/components/orders/useAction";
import { useT } from "@/i18n/client";

/** The answer of the last save, above a form's button: an error, or the note that it worked. */
function Result({ error, done }: { error: string | null; done: string | null }) {
  if (error) return <Alert variant="error">{error}</Alert>;
  return done ? <Alert variant="success">{done}</Alert> : null;
}

export function ProfileForm({ name: initialName, phone: initialPhone }: { name: string; phone: string }) {
  const { run, loading, error, fe } = useAction();
  const t = useT();
  const ready = useHydrated();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [done, setDone] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setDone(null);
    await run("/api/account", { method: "PATCH", json: { name, phone } }, () => setDone(t("Saqlandi.")));
  };
  return (
    <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
      <Field label={t("Ism-familiya")} name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={fe("name")} />
      <Field label={t("Telefon (ixtiyoriy)")} name="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={fe("phone")} />
      <Result error={error} done={done} />
      <Button type="submit" loading={loading} disabled={!ready}>{t("Saqlash")}</Button>
    </form>
  );
}

export function EmailForm({ email: current }: { email: string }) {
  const { run, loading, error, fe } = useAction();
  const t = useT();
  const ready = useHydrated();
  const [email, setEmail] = useState(current);
  const [currentPassword, setPassword] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setDone(null);
    await run("/api/account/email", { json: { email, currentPassword } }, () => {
      setPassword("");
      setDone(t("Email oʻzgartirildi."));
    });
  };
  return (
    <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
      <Field id="new-email" label={t("Yangi email")} name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fe("email")} />
      <Field id="email-password" label={t("Joriy parol")} name="currentPassword" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setPassword(e.target.value)} error={fe("currentPassword")} />
      <Result error={error} done={done} />
      <Button type="submit" loading={loading} disabled={!ready}>{t("Emailni oʻzgartirish")}</Button>
    </form>
  );
}

export function PasswordForm() {
  const { run, loading, error, fe } = useAction();
  const t = useT();
  const ready = useHydrated();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [done, setDone] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setDone(null);
    await run("/api/account/password", { json: form }, () => {
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setDone(t("Parol oʻzgartirildi. Boshqa qurilmalardagi kirishlar tugatildi."));
    });
  };
  return (
    <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
      <Field id="password-current" label={t("Joriy parol")} name="currentPassword" type="password" autoComplete="current-password" value={form.currentPassword} onChange={set("currentPassword")} error={fe("currentPassword")} />
      <Field label={t("Yangi parol")} name="newPassword" type="password" autoComplete="new-password" value={form.newPassword} onChange={set("newPassword")} error={fe("newPassword")} />
      <Field label={t("Yangi parolni takrorlang")} name="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={set("confirmPassword")} error={fe("confirmPassword")} />
      <Result error={error} done={done} />
      <Button type="submit" loading={loading} disabled={!ready}>{t("Parolni oʻzgartirish")}</Button>
    </form>
  );
}

export function SignOutEverywhere() {
  const { run, loading, error } = useAction();
  const t = useT();
  const ready = useHydrated();
  const [done, setDone] = useState<string | null>(null);
  return (
    <div className="mt-4 space-y-4">
      <p className="text-ink-soft">{t("Boshqa telefon va kompyuterlardagi barcha kirishlarni tugatadi. Bu qurilmada qolasiz.")}</p>
      <Result error={error} done={done} />
      <Button type="button" variant="secondary" loading={loading} disabled={!ready} onClick={() => { setDone(null); void run("/api/account/sessions/revoke", {}, () => setDone(t("Boshqa barcha qurilmalardan chiqildi."))); }}>
        {t("Hamma joydan chiqish")}
      </Button>
    </div>
  );
}
