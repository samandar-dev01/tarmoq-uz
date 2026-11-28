"use client";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { cardClasses } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useAction } from "@/components/orders/useAction";
import { useLocale, useT } from "@/i18n/client";
import { tk } from "@/i18n/dictionary";
import { formatUZS } from "@/lib/format";

/** What happens after the tap, in order. */
const STEPS = [
  { title: tk("Karta bilan toʻlaysiz"), text: tk("Toʻlov sahifasiga oʻtasiz.") },
  { title: tk("Buyurtma avtomatik boshlanadi"), text: tk("Chek yuklash shart emas.") },
  { title: tk("Videoni qabul qilasiz"), text: tk("Shungacha pul ushlab turiladi.") },
];

type Props = {
  orderId: string;
  amount: number | null;
  /** What is being bought, and from whom. */
  service: string;
  creator: string;
  /** The client has just come back from Whop's payment page. */
  returned: boolean;
};

/**
 * The automatic payment, shown first at checkout: what is owed, what happens next, and one button that takes the client
 * to Whop's payment page.
 */
export function WhopPay({ orderId, amount, service, creator, returned }: Props) {
  const { run, loading, error, router } = useAction();
  const t = useT();
  const locale = useLocale();
  const [leaving, setLeaving] = useState(false); // the browser is on its way to Whop: the button stays busy
  const busy = loading || leaving;
  const price = amount ? formatUZS(amount, locale) : "—";

  // The Back button may bring this page back exactly as it was left, so the button has to be woken up again.
  useEffect(() => {
    const wake = () => setLeaving(false);
    window.addEventListener("pageshow", wake);
    return () => window.removeEventListener("pageshow", wake);
  }, []);

  const pay = () =>
    run("/api/payments/whop/start", { json: { orderId } }, (data: { url: string | null; paid: boolean }) => {
      if (data.url) {
        setLeaving(true);
        window.location.assign(data.url);
      } else if (data.paid) router.push(`/orders/${orderId}`);
    });

  return (
    <div className="space-y-4">
      {returned && (
        <Alert variant="info">
          {t("Toʻlagan boʻlsangiz, tasdiq bir necha daqiqada keladi. Qayta toʻlamang, sahifani birozdan keyin yangilang.")}
        </Alert>
      )}
      <section className={cardClasses({ padding: "none", radius: "hero", className: "overflow-hidden shadow-lift" })}>
        {/* The same blue in both schemes. The darker corner and the two rings are only depth, behind the text. */}
        <div className="relative isolate overflow-hidden bg-cobalt px-5 py-6 text-on-accent sm:px-7">
          <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-br from-transparent via-cover-night/10 to-cover-night/60" />
          <span aria-hidden="true" className="absolute -right-14 -top-16 -z-10 h-48 w-48 rounded-full border-[1.75rem] border-on-accent/10" />
          <span aria-hidden="true" className="absolute -right-1 -top-3 -z-10 h-20 w-20 rounded-full border-[0.75rem] border-on-accent/10" />
          <p className="inline-flex items-center gap-1.5 rounded-full bg-saffron px-3 py-1 text-xs font-bold text-night">
            <Icon name="bolt" size={14} />
            {t("Avtomatik toʻlov")}
          </p>
          <p className="mt-6 text-sm font-semibold">{t("Toʻlanadigan summa")}</p>
          {/* The price never splits across lines, so a long one gets smaller: the card's width shared among its letters. */}
          <div className="mt-1 [container-type:inline-size]">
            <p className="font-display font-bold leading-tight tracking-tight tabular-nums" style={{ fontSize: `min(2.75rem, calc(100cqw / ${(price.length * 0.66).toFixed(2)}))` }}>
              {price}
            </p>
          </div>
          <div className="mt-5 border-t border-on-accent/25 pt-4">
            <p className="font-bold">{service}</p>
            <p className="text-sm">{t("{name} bilan", { name: creator })}</p>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-7">
          <ol>
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative flex gap-4 pb-5 last:pb-0">
                {i < STEPS.length - 1 && <span aria-hidden="true" className="absolute bottom-1 left-4 top-9 w-px bg-line-strong" />}
                <span
                  aria-hidden="true"
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-extrabold ${i === 0 ? "bg-cobalt text-on-accent" : "bg-cobalt-tint text-cobalt-dark"}`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 pt-1">
                  <p className="font-bold leading-snug">{t(step.title)}</p>
                  <p className="text-sm text-ink-soft">{t(step.text)}</p>
                </div>
              </li>
            ))}
          </ol>
          {error && <Alert variant="error">{error}</Alert>}
          {/* Narrow sides and a text that may wrap, so a small phone keeps both the padlock and the words. */}
          <Button size="lg" className="w-full !px-2" loading={busy} onClick={() => void pay()}>
            {!busy && <Icon name="lock" className="shrink-0" />}
            <span className="whitespace-normal">{leaving ? t("Toʻlov sahifasi ochilmoqda…") : t("Karta bilan onlayn toʻlash")}</span>
          </Button>
          <p className="text-center text-sm text-ink-soft">{t("Karta maʼlumotlari Whop toʻlov sahifasida kiritiladi, Tarmoqda saqlanmaydi.")}</p>
        </div>
      </section>
    </div>
  );
}
