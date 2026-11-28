import { expect, test, type APIRequestContext } from "@playwright/test";
import { apiAs, goodBrief, jasurServiceId, registerApi } from "./helpers";

// Two changes to one order at the same moment must happen one after the other, and nobody may be bound to terms they
// did not see.

const terms = (price: number) => ({ price, deliveryDays: 4, revisions: 1 });

async function buy(client: APIRequestContext, serviceId: string) {
  const res = await client.post("/api/orders", { data: { serviceId, brief: goodBrief, accept: true } });
  expect(res.status()).toBe(201);
  return (await res.json()).order.id as string;
}

test("accepting terms while the creator replaces them never makes the client owe a price they did not accept", async () => {
  const jasur = await apiAs("jasur@demo.test");
  const { ctx: client } = await registerApi("CLIENT");
  const serviceId = await jasurServiceId(client);
  const bad: string[] = [];
  for (let i = 0; i < 20; i++) { // 20 orders an hour is the most one client may place
    const id = await buy(client, serviceId);
    const second = await jasur.post(`/api/orders/${id}/propose`, { data: terms(300000) });
    expect(second.status()).toBe(201);
    const termsHash = (await second.json()).agreement.termsHash as string;
    const [accepted, replaced] = await Promise.all([
      new Promise((r) => setTimeout(r, i % 8)).then(() => client.post(`/api/orders/${id}/agreement`, { data: { termsHash, accept: true } })),
      jasur.post(`/api/orders/${id}/propose`, { data: terms(900000) }),
    ]);
    // Either one may lose, but never with a server error.
    expect([200, 409]).toContain(accepted.status());
    expect([201, 409]).toContain(replaced.status());
    // The client never accepted 900 000, so there must be no way to charge it.
    const intent = await client.post("/api/payments/sandbox/intent", { data: { orderId: id } });
    if (intent.ok() && (await intent.json()).payment.amount === 900000) bad.push(`round ${i}: accept ${accepted.status()}, replace ${replaced.status()}`);
  }
  expect(bad).toEqual([]);
});

test("two requests sent at the same moment leave only one waiting for an answer", async () => {
  const jasur = await apiAs("jasur@demo.test");
  const { ctx: client } = await registerApi("CLIENT");
  const serviceId = await jasurServiceId(client);
  const bad: string[] = [];
  for (let i = 0; i < 8; i++) {
    const id = await buy(client, serviceId);
    const intent = await (await client.post("/api/payments/sandbox/intent", { data: { orderId: id } })).json();
    const paid = await client.post("/api/payments/sandbox/confirm", {
      data: { orderId: id, paymentId: intent.payment.id, cardNumber: "4242 4242 4242 4242", expMonth: 12, expYear: 2034, cvc: "123" },
    });
    expect(paid.status()).toBe(200);
    const ask = { type: "CANCEL", reason: "Tadbir bekor boʻldi, kechirasiz." };
    const both = await Promise.all([client.post(`/api/orders/${id}/requests`, { data: ask }), jasur.post(`/api/orders/${id}/requests`, { data: ask })]);
    const made = both.filter((r) => r.status() === 201).length;
    if (made !== 1) bad.push(`round ${i}: ${both.map((r) => r.status()).join(" and ")}`);
  }
  expect(bad).toEqual([]);
});

test("a package that changed after the client read it is not bought on the new terms", async () => {
  const { ctx: client } = await registerApi("CLIENT");
  const serviceId = await jasurServiceId(client);
  const stale = await client.post("/api/orders", {
    data: { serviceId, brief: goodBrief, accept: true, seen: { price: 20000, deliveryDays: 1, revisions: 0 } },
  });
  expect(stale.status()).toBe(409);
});

test("the admin is told that a cancellation was agreed by both sides, and why", async () => {
  const jasur = await apiAs("jasur@demo.test");
  const admin = await apiAs("admin@demo.test");
  const { ctx: client } = await registerApi("CLIENT");
  const id = await buy(client, await jasurServiceId(client));
  const intent = await (await client.post("/api/payments/sandbox/intent", { data: { orderId: id } })).json();
  await client.post("/api/payments/sandbox/confirm", {
    data: { orderId: id, paymentId: intent.payment.id, cardNumber: "4242 4242 4242 4242", expMonth: 12, expYear: 2034, cvc: "123" },
  });
  const reason = `Kelishib bekor qilamiz ${id}`;
  const asked = await client.post(`/api/orders/${id}/requests`, { data: { type: "CANCEL", reason } });
  const requestId = (await asked.json()).request.id as string;
  expect((await jasur.post(`/api/orders/${id}/requests/${requestId}`, { data: { action: "accept" } })).status()).toBe(200);
  const page = await (await admin.get("/admin/orders")).text();
  expect(page).toContain(reason);
  expect(page).toContain("Ikkala tomon bekor qilishga rozi boʻlgan");
  // Paying the creator would go against what both agreed.
  expect((await admin.post(`/api/admin/orders/${id}/resolve`, { data: { resolution: "release" } })).status()).toBe(409);
  expect((await admin.post(`/api/admin/orders/${id}/resolve`, { data: { resolution: "refund" } })).status()).toBe(200);
});
