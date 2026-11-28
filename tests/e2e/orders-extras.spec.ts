import { expect, test } from "@playwright/test";
import { apiAs, goodBrief, jasurServiceId, registerApi } from "./helpers";

// Buying a package directly, changing its terms before paying, the resolution centre, and a custom offer in a chat.
test("a bought order waits for payment; either side may change the terms, and the other has to accept", async () => {
  const client = await registerApi("CLIENT");
  const jasur = await apiAs("jasur@demo.test");
  const serviceId = await jasurServiceId(client.ctx);
  const bought = await client.ctx.post("/api/orders", { data: { serviceId, brief: goodBrief, accept: true } });
  expect(bought.status()).toBe(201);
  const orderId = (await bought.json()).order.id as string;
  expect((await bought.json()).order.status).toBe("AWAITING_PAYMENT");

  // The client asks for a different price: only the creator can accept it.
  const asked = await client.ctx.post(`/api/orders/${orderId}/counter`, { data: { price: 250000, deliveryDays: 4, revisions: 1 } });
  expect(asked.status()).toBe(201);
  const hash = (await asked.json()).agreement.termsHash as string;
  expect((await client.ctx.post(`/api/orders/${orderId}/agreement`, { data: { termsHash: hash, accept: true } })).status()).toBe(409);
  expect((await client.ctx.post("/api/payments/sandbox/intent", { data: { orderId } })).status()).toBe(409); // nothing to pay yet
  expect((await jasur.post(`/api/orders/${orderId}/agreement`, { data: { termsHash: hash, accept: true } })).status()).toBe(200);
  const intent = await (await client.ctx.post("/api/payments/sandbox/intent", { data: { orderId } })).json();
  expect(intent.payment.amount).toBe(250000);
  await client.ctx.post("/api/payments/sandbox/confirm", { data: { orderId, paymentId: intent.payment.id, cardNumber: "4242 4242 4242 4242", expMonth: 12, expYear: 2034, cvc: "123" } });

  // Paid: more time can be asked for; the asker cannot answer their own request.
  const extend = await jasur.post(`/api/orders/${orderId}/requests`, { data: { type: "EXTEND", extraDays: 2, reason: "Kamera taʼmirda, ikki kun kerak." } });
  expect(extend.status()).toBe(201);
  const requestId = (await extend.json()).request.id as string;
  expect((await jasur.post(`/api/orders/${orderId}/requests/${requestId}`, { data: { action: "accept" } })).status()).toBe(403);
  expect((await client.ctx.post(`/api/orders/${orderId}/requests/${requestId}`, { data: { action: "accept" } })).status()).toBe(200);

  // An agreed cancellation goes to the admin; no money moves by itself.
  const cancel = await client.ctx.post(`/api/orders/${orderId}/requests`, { data: { type: "CANCEL", reason: "Tadbir bekor boʻldi, kechirasiz." } });
  const cancelId = (await cancel.json()).request.id as string;
  expect((await jasur.post(`/api/orders/${orderId}/requests/${cancelId}`, { data: { action: "accept" } })).status()).toBe(200);
  const page = await (await client.ctx.get(`/orders/${orderId}`)).text();
  expect(page).toContain("Nizoda");

  // Both heard about it.
  expect((await (await client.ctx.get("/api/notifications/count")).json()).notices).toBeGreaterThan(0);
});

test("a custom offer in a chat becomes an order only when the client accepts it", async () => {
  const client = await registerApi("CLIENT");
  const jasur = await apiAs("jasur@demo.test");
  const me = (await (await client.ctx.get("/api/auth/me")).json()).user.id as string;
  const profile = await (await client.ctx.get("/providers/jasur-karimov")).text();
  const to = /messages%2Fnew%3Fto%3D([a-z0-9]+)|messages\/new\?to=([a-z0-9]+)/.exec(profile);
  const jasurId = (to?.[1] ?? to?.[2])!;
  const opened = await client.ctx.get(`/messages/new?to=${jasurId}`);
  const conversationId = new URL(opened.url()).pathname.split("/").pop()!;
  const serviceId = await jasurServiceId(client.ctx);
  expect(me).toBeTruthy();

  const offer = { serviceId, description: "Ikki reel, bitta kunda suratga olinadi.", price: 500000, deliveryDays: 3, revisions: 2 };
  expect((await client.ctx.post(`/api/conversations/${conversationId}/offers`, { data: offer })).status()).toBe(403);
  const sent = await jasur.post(`/api/conversations/${conversationId}/offers`, { data: offer });
  expect(sent.status()).toBe(201);
  const offerId = (await sent.json()).offer.id as string;
  expect((await jasur.post(`/api/offers/${offerId}`, { data: { action: "accept", accept: true } })).status()).toBe(403);
  expect((await client.ctx.post(`/api/offers/${offerId}`, { data: { action: "accept" } })).status()).toBe(400); // terms not accepted
  const accepted = await client.ctx.post(`/api/offers/${offerId}`, { data: { action: "accept", accept: true } });
  expect(accepted.status()).toBe(200);
  const orderId = (await accepted.json()).orderId as string;
  const intent = await (await client.ctx.post("/api/payments/sandbox/intent", { data: { orderId } })).json();
  expect(intent.payment.amount).toBe(500000);
  expect((await client.ctx.post(`/api/offers/${offerId}`, { data: { action: "accept", accept: true } })).status()).toBe(409); // once only
});
