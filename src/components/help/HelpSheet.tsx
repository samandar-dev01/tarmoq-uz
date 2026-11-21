"use client";
import { buttonClasses } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Sheet } from "@/components/ui/Sheet";
import { useT } from "@/i18n/client";
import { SUPPORT_TELEGRAM_URL } from "@/lib/support";
import type { HelpRole } from "./HelpProvider";
import { SupportThread } from "./SupportThread";

/**
 * Help, in one panel: write to the support team on the site (a signed-in client or creator; an admin never sees this, they
 * answer from /admin/support) or on Telegram (anyone). A visitor is offered Telegram and the way in.
 */
export function HelpSheet({ open, onClose, role }: { open: boolean; onClose: () => void; role: HelpRole }) {
  const t = useT();
  const writes = role === "CLIENT" || role === "PROVIDER";
  return (
    <Sheet open={open} onClose={onClose} title={t("Yordam")} closeLabel={t("Yopish")}>
      <div className="space-y-3 border-b border-line p-4">
        <p className="text-ink-soft">
          {writes
            ? t("Savolingizni yozing, javobni shu yerda koʻrasiz. Telegramda ham yozishingiz mumkin.")
            : t("Savolingiz bormi? Telegramda yozing yoki tizimga kirib, shu yerda yozing.")}
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={SUPPORT_TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            {t("Telegramda yozish")}
          </a>
          {!role && <ButtonLink href="/login?role=client" size="sm" onClick={onClose}>{t("Kirish")}</ButtonLink>}
        </div>
      </div>
      {writes && (
        <SupportThread
          side="user"
          endpoint="/api/support"
          initialMessages={null}
          labels={{
            empty: t("Savolingizni yozing, javobni shu yerda koʻrasiz."),
            field: t("Xabar"),
            placeholder: t("Xabaringizni yozing…"), // short: the box is narrow on a phone
            send: t("Yuborish"),
            notSent: t("Xabarni yuborib boʻlmadi."),
            offline: t("Internet aloqasida muammo. Xabaringiz yuborilmadi."),
            reconnecting: t("Aloqa muammosi. Qayta uriniladi…"),
          }}
        />
      )}
    </Sheet>
  );
}
