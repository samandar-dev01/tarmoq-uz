import { getT } from "@/i18n/server";
import { paymentsAreTest } from "@/lib/payments/mode";
import { tagClasses } from "./Card";

/**
 * Sits right beside any public sentence that promises held or protected payment. While payments are the
 * sandbox it says so in plain sight; once a real gateway is live it renders nothing.
 */
export async function TestModeBadge({ className = "" }: { className?: string }) {
  if (!paymentsAreTest()) return null;
  const t = await getT();
  return (
    <span className={`${tagClasses("saffron")} whitespace-nowrap align-middle ${className}`.trim()} title={t("Toʻlovlar hozircha sinov rejimida ishlaydi: haqiqiy pul yechilmaydi.")}>
      {t("Sinov rejimi")}
    </span>
  );
}
