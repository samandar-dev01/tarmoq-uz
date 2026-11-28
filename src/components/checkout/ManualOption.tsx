"use client";
import type { ReactNode, SyntheticEvent } from "react";
import { cardClasses } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useT } from "@/i18n/client";
import { TRANSFER_QUERY } from "@/lib/payments/manualPure";

/**
 * The card transfer when online payment is offered too: one button, with the transfer details folded under it.
 * The choice is written into the page address, so a phone that reloads the page after a visit to the bank app finds the
 * details open again.
 */
export function ManualOption({ initialOpen, children }: { initialOpen: boolean; children: ReactNode }) {
  const t = useT();

  function remember(e: SyntheticEvent<HTMLDetailsElement>) {
    const url = new URL(window.location.href);
    if (e.currentTarget.open) url.searchParams.set(TRANSFER_QUERY.name, TRANSFER_QUERY.value);
    else url.searchParams.delete(TRANSFER_QUERY.name);
    if (url.href !== window.location.href) window.history.replaceState(null, "", url);
  }

  return (
    <details open={initialOpen} onToggle={remember} className="group">
      <summary className={cardClasses({ padding: "sm", className: "flex list-none items-center gap-4 border-line-strong transition-colors duration-150 hover:bg-paper-deep" })}>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-paper-deep text-ink">
          <Icon name="transfer" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold leading-snug">{t("Kartaga oʻtkazma bilan toʻlash")}</span>
          <span className="mt-0.5 block text-sm text-ink-soft">{t("Onlayn toʻlov oʻtmasa: chek yuklaysiz, administrator tasdiqlaydi.")}</span>
        </span>
        <Icon name="chevron" className="shrink-0 text-ink-mute transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="mt-5">{children}</div>
    </details>
  );
}
