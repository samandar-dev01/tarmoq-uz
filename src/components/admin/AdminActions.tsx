"use client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { useAction } from "@/components/orders/useAction";

export function ProviderActions({ id, status }: { id: string; status: string }) {
  const { run, loading, error } = useAction();
  const act = (action: string) => run(`/api/admin/providers/${id}`, { method: "PATCH", json: { action } });
  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex flex-wrap gap-3">
        {status === "PENDING_REVIEW" && (
          <>
            <Button loading={loading} onClick={() => act("approve")}>Tasdiqlash</Button>
            <Button variant="secondary" disabled={loading} onClick={() => act("reject")}>Tuzatishga qaytarish</Button>
          </>
        )}
        {(status === "APPROVED" || status === "PENDING_REVIEW") && (
          <Button variant="danger" disabled={loading} onClick={() => { if (window.confirm("Ijodkor toʻxtatilsinmi? U qidiruvdan yoʻqoladi.")) void act("suspend"); }}>Toʻxtatish</Button>
        )}
        {status === "SUSPENDED" && <Button loading={loading} onClick={() => act("reinstate")}>Qayta faollashtirish</Button>}
      </div>
    </div>
  );
}

export function ReviewToggle({ id, hidden }: { id: string; hidden: boolean }) {
  const { run, loading, error } = useAction();
  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      <Button variant={hidden ? "secondary" : "danger"} loading={loading} onClick={() => run(`/api/admin/reviews/${id}`, { method: "PATCH", json: { hidden: !hidden } })}>
        {hidden ? "Sharhni tiklash" : "Sharhni yashirish"}
      </Button>
    </div>
  );
}

export function ResolveDispute({ orderId }: { orderId: string }) {
  const { run, loading, error } = useAction();
  const resolve = (resolution: "release" | "refund") => {
    const msg = resolution === "release" ? "Ushlab turilgan pul ijodkorga oʻtkazilsinmi?" : "Ushlab turilgan pul mijozga qaytarilsinmi?";
    if (window.confirm(msg)) void run(`/api/admin/orders/${orderId}/resolve`, { json: { resolution } });
  };
  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex flex-wrap gap-3">
        <Button loading={loading} onClick={() => resolve("release")}>Ijodkorga oʻtkazish</Button>
        <Button variant="secondary" disabled={loading} onClick={() => resolve("refund")}>Mijozga qaytarish</Button>
      </div>
    </div>
  );
}
