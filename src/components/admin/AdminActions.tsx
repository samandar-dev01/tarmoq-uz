"use client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { useAction } from "@/components/orders/useAction";

export function ProviderActions({ id, status }: { id: string; status: string }) {
  const { run, loading, error } = useAction();
  const act = (action: string) => run(`/api/admin/providers/${id}`, { method: "PATCH", json: { action } });
  return (
    <div className="space-y-2">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {status === "PENDING_REVIEW" && (
          <>
            <Button loading={loading} onClick={() => act("approve")}>Approve</Button>
            <Button variant="secondary" disabled={loading} onClick={() => act("reject")}>Send back</Button>
          </>
        )}
        {(status === "APPROVED" || status === "PENDING_REVIEW") && (
          <Button variant="danger" disabled={loading} onClick={() => { if (window.confirm("Suspend this provider? They will disappear from search.")) void act("suspend"); }}>Suspend</Button>
        )}
        {status === "SUSPENDED" && <Button loading={loading} onClick={() => act("reinstate")}>Reinstate</Button>}
      </div>
    </div>
  );
}

export function ReviewToggle({ id, hidden }: { id: string; hidden: boolean }) {
  const { run, loading, error } = useAction();
  return (
    <div className="space-y-2">
      {error && <Alert variant="error">{error}</Alert>}
      <Button variant={hidden ? "secondary" : "danger"} loading={loading} onClick={() => run(`/api/admin/reviews/${id}`, { method: "PATCH", json: { hidden: !hidden } })}>
        {hidden ? "Restore review" : "Hide review"}
      </Button>
    </div>
  );
}

export function ResolveDispute({ orderId }: { orderId: string }) {
  const { run, loading, error } = useAction();
  const resolve = (resolution: "release" | "refund") => {
    const msg = resolution === "release" ? "Release the held payment to the provider?" : "Refund the held payment to the client?";
    if (window.confirm(msg)) void run(`/api/admin/orders/${orderId}/resolve`, { json: { resolution } });
  };
  return (
    <div className="space-y-2">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button loading={loading} onClick={() => resolve("release")}>Release to provider</Button>
        <Button variant="secondary" disabled={loading} onClick={() => resolve("refund")}>Refund client</Button>
      </div>
    </div>
  );
}
