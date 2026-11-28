"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n/client";

/** Asks the browser for permission to show alerts while the site is open in a tab. Hidden where it cannot or need not ask. */
export function AllowAlerts() {
  const t = useT();
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    setAsk("Notification" in window && Notification.permission === "default");
  }, []);
  if (!ask) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button type="button" variant="secondary" size="sm" onClick={async () => { await Notification.requestPermission(); setAsk(false); }}>
        {t("Brauzer ogohlantirishlarini yoqish")}
      </Button>
      <span className="text-sm text-ink-soft">{t("Sayt ochiq turganda yangi xabar haqida ogohlantiradi.")}</span>
    </div>
  );
}
