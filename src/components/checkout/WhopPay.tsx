"use client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { useAction } from "@/components/orders/useAction";
import { useT } from "@/i18n/client";

/** The online card payment: one button that takes the client to Whop's payment page. */
export function WhopPay({ orderId, returned }: { orderId: string; returned: boolean }) {
  const { run, loading, error, router } = useAction();
  const t = useT();

  const pay = () =>
    run("/api/payments/whop/start", { json: { orderId } }, (data: { url: string | null; paid: boolean }) => {
      if (data.url) window.location.assign(data.url);
      else if (data.paid) router.push(`/orders/${orderId}`);
    });

  return (
    <div className="space-y-4">
      {returned && (
        <Alert variant="info">
          {t("Toʻlagan boʻlsangiz, tasdiq bir necha daqiqada keladi. Qayta toʻlamang, sahifani birozdan keyin yangilang.")}
        </Alert>
      )}
      {error && <Alert variant="error">{error}</Alert>}
      <Button size="lg" className="w-full" loading={loading} onClick={() => void pay()}>
        {t("Karta bilan onlayn toʻlash")}
      </Button>
      <p className="text-sm text-ink-soft">{t("Toʻlov sahifasiga oʻtasiz. Toʻlov oʻtgach, buyurtma avtomatik boshlanadi.")}</p>
    </div>
  );
}
