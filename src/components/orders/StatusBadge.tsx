import type { OrderStatus } from "@prisma/client";
import { translate } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/config";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/orderUi";

/**
 * `locale` is the reader's language; left out it is Uzbek, which is what the admin pages (Uzbek only) rely on. The pages a
 * client or a creator reads pass the language they resolved with `getLocale()`.
 */
export function StatusBadge({ status, locale = "uz" }: { status: OrderStatus; locale?: Locale }) {
  return (
    <span data-testid="order-status" className={`inline-block rounded-full border border-line px-3 py-1 text-xs font-bold ${STATUS_STYLE[status]}`}>
      {translate(locale, STATUS_LABEL[status])}
    </span>
  );
}
