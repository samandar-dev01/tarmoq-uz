import { LoginForm } from "@/components/auth/LoginForm";
import { RoleTabs } from "@/components/auth/RoleTabs";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { tk } from "@/i18n/dictionary";
import { getT } from "@/i18n/server";
import { DOORS, parseDoor } from "@/lib/authRole";
import { WRONG_DOOR } from "@/lib/doorMessages";
import { googleEnabled } from "@/lib/googleAuth";
import { mailEnabled } from "@/lib/mail";
import { safeNext } from "@/lib/safeNext";

export async function generateMetadata() {
  return { title: (await getT())("Kirish") };
}

type Param = string | string[] | undefined;
type Props = { searchParams: Promise<{ role?: Param; next?: Param; google?: Param; door?: Param }> };

const HEADING = { client: tk("Mijoz sifatida kirish"), provider: tk("Ijodkor sifatida kirish"), admin: tk("Admin") } as const;

// Why "Continue with Google" sent the person back here (`?google=`, written by the routes in src/lib/googleAuth.ts).
// A wrong door has its own sentences (src/lib/doorMessages.ts) and a link to the right door.
const GOOGLE_NOTICE: Record<string, string> = {
  cancelled: tk("Google orqali kirish bekor qilindi."),
  unverified: tk("Google hisobingizdagi email tasdiqlanmagan. Emailni tasdiqlab, qayta urinib koʻring."),
  admin: tk("Admin hisobi Google orqali kirmaydi. Email va parol bilan kiring."),
  two_factor: tk("Bu hisobda ikki bosqichli kirish yoqilgan. Email, parol va ilovadagi kod bilan kiring."),
  inactive: tk("Bu hisob faolsizlantirilgan."),
  limited: tk("Urinishlar juda koʻp. Birozdan keyin qayta urinib koʻring."),
  failed: tk("Google orqali kirib boʻlmadi. Qayta urinib koʻring."),
};

const one = (v: Param) => (Array.isArray(v) ? v[0] : v);

export default async function LoginPage(props: Props) {
  const searchParams = await props.searchParams;
  const role = parseDoor(searchParams.role);
  const next = safeNext(one(searchParams.next));
  const t = await getT();
  const problem = one(searchParams.google);
  const rightDoor = DOORS.find((d) => d === one(searchParams.door));
  const notice =
    problem === "wrong_door" && rightDoor
      ? { message: t(WRONG_DOOR[rightDoor]), door: rightDoor }
      : problem && GOOGLE_NOTICE[problem]
        ? { message: t(GOOGLE_NOTICE[problem]), info: problem === "cancelled" }
        : null;
  return (
    <Container size="sm">
      <h1>{t(HEADING[role])}</h1>
      {/* The admin door is not a public tab: it has the form only. */}
      {role !== "admin" && (
        <>
          <p className="mt-2 text-ink-soft">
            {role === "provider" ? t("Soʻrovlar, buyurtmalar va toʻlovlaringiz shu yerda.") : t("Buyurtmalaringiz va xabarlaringiz shu yerda.")}
          </p>
          <div className="mt-6"><RoleTabs page="/login" role={role} next={next} /></div>
        </>
      )}
      <Card padding="lg" className={role === "admin" ? "mt-6" : "mt-4"}>
        <LoginForm role={role} next={next} googleEnabled={googleEnabled()} notice={notice} resetEnabled={mailEnabled()} />
      </Card>
    </Container>
  );
}
