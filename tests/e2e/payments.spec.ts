import { test, expect } from "@playwright/test";
import { apiAs, registerApi, jasurServiceId, goodBrief } from "./helpers";

// Payment success must come from the server's own check of the card, never from anything the browser claims.
test("sandbox payments cannot be faked", async () => {
  const client = await registerApi("CLIENT");
  const jasur = await apiAs("jasur@demo.test");

  const serviceId = await jasurServiceId(client.ctx);
  const orderId = (await (await client.ctx.post("/api/orders", { data: { serviceId, brief: goodBrief } })).json()).order.id as string;
  const proposed = await (await jasur.post(`/api/orders/${orderId}/propose`, { data: { price: 300000, deliveryDays: 2, revisions: 1 } })).json();
  expect((await client.ctx.post(`/api/orders/${orderId}/agreement`, { data: { termsHash: proposed.agreement.termsHash, accept: true } })).status()).toBe(200);

  const intent = async () => (await (await client.ctx.post("/api/payments/sandbox/intent", { data: { orderId } })).json()).payment as { id: string; amount: number };
  const confirm = (paymentId: string, cardNumber: string, extra: Record<string, unknown> = {}) =>
    client.ctx.post("/api/payments/sandbox/confirm", { data: { orderId, paymentId, cardNumber, expMonth: 12, expYear: 2034, cvc: "123", ...extra } });

  let payment = await intent();
  expect(payment.amount).toBe(300000); // amount comes from the agreement, not from the browser

  // a made-up card, or a request that claims success, changes nothing
  expect((await confirm(payment.id, "1111 1111 1111 1111")).status()).toBe(400);
  expect((await confirm(payment.id, "1111 1111 1111 1111", { success: true, status: "HELD" })).status()).toBe(400);
  expect((await confirm(payment.id, "not a number")).status()).toBe(400);

  // a declined card fails the attempt; the client must start a fresh attempt
  const declined = await confirm(payment.id, "4000 0000 0000 0002");
  expect(declined.status()).toBe(402);
  expect((await declined.json()).code).toBe("card_declined");
  expect((await confirm(payment.id, "4242 4242 4242 4242")).status()).toBe(409); // old attempt is closed

  payment = await intent();
  const nsf = await confirm(payment.id, "4000 0000 0000 9995");
  expect(nsf.status()).toBe(402);
  expect((await nsf.json()).code).toBe("insufficient_funds");

  // the provider cannot start work: nothing has been paid
  const fake = await jasur.post(`/api/orders/${orderId}/delivery`, { multipart: { file: { name: "a.mp4", mimeType: "video/mp4", buffer: Buffer.from("x") } } });
  expect(fake.status()).toBe(409);

  // success
  payment = await intent();
  expect((await confirm(payment.id, "4242 4242 4242 4242")).status()).toBe(200);

  // paying twice is impossible
  expect((await confirm(payment.id, "4242 4242 4242 4242")).status()).toBe(409);
  expect((await client.ctx.post("/api/payments/sandbox/intent", { data: { orderId } })).status()).toBe(409);

  // now the provider may deliver, but a non-video is rejected
  const bad = await jasur.post(`/api/orders/${orderId}/delivery`, { multipart: { file: { name: "virus.exe", mimeType: "application/octet-stream", buffer: Buffer.from("x") } } });
  expect(bad.status()).toBe(400);
  const good = await jasur.post(`/api/orders/${orderId}/delivery`, { multipart: { file: { name: "reel.mp4", mimeType: "video/mp4", buffer: Buffer.from("fake video bytes") } } });
  expect(good.status()).toBe(201);

  // the client cannot upload deliveries, and the provider cannot approve their own work
  expect((await client.ctx.post(`/api/orders/${orderId}/delivery`, { multipart: { file: { name: "a.mp4", mimeType: "video/mp4", buffer: Buffer.from("x") } } })).status()).toBe(403);
  expect((await jasur.post(`/api/orders/${orderId}/approve`)).status()).toBe(403);

  // approving completes the order exactly once
  expect((await client.ctx.post(`/api/orders/${orderId}/approve`)).status()).toBe(200);
  expect((await client.ctx.post(`/api/orders/${orderId}/approve`)).status()).toBe(409);

  // review: validated, saved once
  expect((await client.ctx.post(`/api/orders/${orderId}/review`, { data: { rating: 6, comment: "Way too many stars here." } })).status()).toBe(400);
  expect((await client.ctx.post(`/api/orders/${orderId}/review`, { data: { rating: 4, comment: "Good job, would hire again." } })).status()).toBe(201);
  expect((await client.ctx.post(`/api/orders/${orderId}/review`, { data: { rating: 5, comment: "Trying to review twice." } })).status()).toBe(409);

  await client.ctx.dispose();
  await jasur.dispose();
});
