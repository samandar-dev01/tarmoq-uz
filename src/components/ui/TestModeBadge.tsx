import { paymentsAreTest } from "@/lib/payments/mode";
import { tagClasses } from "./Card";

/**
 * Sits right beside any public sentence that promises held or protected payment. While payments are the
 * sandbox it says so in plain sight; once a real gateway is live it renders nothing.
 */
export function TestModeBadge({ className = "" }: { className?: string }) {
  if (!paymentsAreTest()) return null;
  return (
    <span className={`${tagClasses("saffron")} whitespace-nowrap align-middle ${className}`.trim()} title="Toʻlovlar hozircha sinov rejimida ishlaydi: haqiqiy pul yechilmaydi.">
      Sinov rejimi
    </span>
  );
}
