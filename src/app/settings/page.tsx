import { requirePageRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getT } from "@/i18n/server";
import { avatarUrl } from "@/lib/avatar";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { AvatarForm } from "@/components/settings/AvatarForm";
import { EmailForm, PasswordForm, ProfileForm, SignOutEverywhere } from "@/components/settings/AccountForms";
import { TwoFactorForm, VerifyEmailAgain } from "@/components/security/SecurityForms";
import { mailEnabled } from "@/lib/mail";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Sozlamalar"), robots: { index: false, follow: false } };
}

export default async function SettingsPage() {
  const user = await requirePageRole("CLIENT", "PROVIDER", "ADMIN");
  const t = await getT();
  // Only whether there is a password, never the hash itself.
  const account = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true, totpEnabledAt: true, emailVerifiedAt: true } });
  const hasPassword = !!account.passwordHash;
  return (
    <Container size="md">
      <h1>{t("Sozlamalar")}</h1>
      <div className="mt-8 space-y-5">
        <Card as="section" padding="lg">
          <h2>{t("Profil rasmi")}</h2>
          <AvatarForm name={user.name} src={avatarUrl(user)} />
        </Card>
        <Card as="section" padding="lg">
          <h2>{t("Shaxsiy maʼlumotlar")}</h2>
          <ProfileForm name={user.name} phone={user.phone ?? ""} />
        </Card>
        {hasPassword ? (
          <>
            <Card as="section" padding="lg">
              <h2>{t("Email")}</h2>
              <EmailForm email={user.email} />
            </Card>
            <Card as="section" padding="lg">
              <h2>{t("Parol")}</h2>
              <PasswordForm />
            </Card>
            <Card as="section" padding="lg">
              <h2>{t("Ikki bosqichli kirish")}</h2>
              <TwoFactorForm enabled={!!account.totpEnabledAt} />
            </Card>
            {mailEnabled() && (
              <Card as="section" padding="lg">
                <h2>{t("Emailni tasdiqlash")}</h2>
                {account.emailVerifiedAt ? <p className="mt-3 text-ink-soft">{t("Email tasdiqlandi. Rahmat!")}</p> : <VerifyEmailAgain />}
              </Card>
            )}
          </>
        ) : (
          <Alert variant="info">{t("Bu hisob Google orqali kiradi, shuning uchun parol va email bu yerda oʻzgartirilmaydi.")}</Alert>
        )}
        <Card as="section" padding="lg">
          <h2>{t("Boshqa qurilmalar")}</h2>
          <SignOutEverywhere />
        </Card>
      </div>
    </Container>
  );
}
