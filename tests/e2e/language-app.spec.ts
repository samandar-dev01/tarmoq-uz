import { request as pwRequest, test, expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { goodBrief, jasurServiceId, PASSWORD, settled, tinyMp4 } from "./helpers";

// The SIGNED-IN half of the language work: what a client and a creator see after signing in, in Russian: the cabinets, the
// order pages in every status, the agreement, checkout, messages and the chat, the creator's payout card and the profile
// wizard, and what the server says when something is wrong.
//
// Russian is behind one switch (RUSSIAN_LIVE in src/i18n/config.ts) and is OFF. As in language-core.spec.ts this file has two
// halves: "Russian off" runs on the app every other spec uses; "Russian on" needs the second copy of the build that the
// production-style rig starts (E2E_RU_BASE_URL, scripts/e2e-prod/README.md, "Russian") and skips itself without it.
//
// All data is thrown away: every scenario makes its own client and orders through the API. Nothing here reads a rate-limit
// counter; each client stays well under the order limit by creating only a handful of orders.

const RU_BASE = process.env.E2E_RU_BASE_URL;
const UZ_BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const CYRILLIC = /[А-Яа-яЁё]/;
// Money in Russian has non-breaking spaces ("300 000 сум"); \s matches them.
const money = (n: number) => new RegExp(n.toLocaleString("en-US").replace(/,/g, "\\s") + "\\sсум");

type Status = "REQUESTED" | "AGREEMENT_PENDING" | "AWAITING_PAYMENT" | "IN_PROGRESS" | "DELIVERED" | "COMPLETED" | "CANCELLED" | "DISPUTED";
type World = { client: APIRequestContext; jasur: APIRequestContext; serviceId: string; base: string };

async function signedIn(base: string, email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: base });
  const res = await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } });
  if (!res.ok()) throw new Error(`Login failed for ${email}: HTTP ${res.status()}`);
  return ctx;
}

async function registered(base: string, role: "CLIENT" | "PROVIDER", name = "E2E Tester") {
  const ctx = await pwRequest.newContext({ baseURL: base });
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
  const res = await ctx.post("/api/auth/register", { data: { name, email, password: "Passw0rd!x", role } });
  if (!res.ok()) throw new Error(`Register failed: HTTP ${res.status()}`);
  return { ctx, email };
}

async function newWorld(base: string): Promise<World> {
  const { ctx: client } = await registered(base, "CLIENT");
  const jasur = await signedIn(base, "jasur@demo.test");
  return { client, jasur, serviceId: await jasurServiceId(client), base };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ok = async (res: Awaited<ReturnType<APIRequestContext["post"]>>, what: string): Promise<any> => {
  if (!res.ok()) throw new Error(`${what}: HTTP ${res.status()} ${await res.text()}`);
  return res.json();
};

/** A fresh order for the world's client with Jasur, taken through the real API up to `status`. Returns its id. */
async function orderAt(w: World, status: Status, brief = goodBrief): Promise<string> {
  const id = (await ok(await w.client.post("/api/orders", { data: { serviceId: w.serviceId, brief } }), "create order")).order.id as string;
  if (status === "REQUESTED") return id;
  if (status === "CANCELLED") {
    await ok(await w.client.post(`/api/orders/${id}/cancel`, { data: {} }), "cancel");
    return id;
  }
  const proposed = await ok(
    await w.jasur.post(`/api/orders/${id}/propose`, { data: { price: 300000, deliveryDays: 2, revisions: 1, notes: "Ikki joy\nChilonzor, soat 18:00" } }),
    "propose",
  );
  if (status === "AGREEMENT_PENDING") return id;
  await ok(await w.client.post(`/api/orders/${id}/agreement`, { data: { termsHash: proposed.agreement.termsHash, accept: true } }), "accept");
  if (status === "AWAITING_PAYMENT") return id;
  const payment = (await ok(await w.client.post("/api/payments/sandbox/intent", { data: { orderId: id } }), "intent")).payment as { id: string };
  await ok(
    await w.client.post("/api/payments/sandbox/confirm", { data: { orderId: id, paymentId: payment.id, cardNumber: "4242 4242 4242 4242", expMonth: 12, expYear: 2034, cvc: "123" } }),
    "pay",
  );
  if (status === "IN_PROGRESS") return id;
  if (status === "DISPUTED") {
    await ok(await w.client.post(`/api/orders/${id}/dispute`, { data: { reason: "Ish kelishilgandek chiqmadi, tuzatish kerak." } }), "dispute");
    return id;
  }
  await ok(await w.jasur.post(`/api/orders/${id}/delivery`, { multipart: { file: { name: "reel.mp4", mimeType: "video/mp4", buffer: tinyMp4 } } }), "deliver");
  if (status === "DELIVERED") return id;
  await ok(await w.client.post(`/api/orders/${id}/approve`), "approve");
  return id; // COMPLETED
}

/** A browser page signed in as the API context's user, with the language cookie set. */
async function pageFor(browser: Browser, ctx: APIRequestContext, base: string, lang: "ru" | "uz" | null = "ru", viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ baseURL: base, storageState: await ctx.storageState(), viewport });
  if (lang) await context.addCookies([{ name: "lang", value: lang, url: base }]);
  const page = await context.newPage();
  return { page, context };
}

function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    // The browser logs every refused request (a rejected form is one); those are meant, and so is the player's complaint about
    // the tiny stand-in file the tests upload as a "video". A hydration mismatch is not.
    if (m.location().url.includes("/delivery/")) return;
    if ((m.type() === "error" || m.type() === "warning") && !m.text().startsWith("Failed to load resource")) problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

/**
 * The text a reader sees that still has Uzbek apostrophe letters (ʻ ʼ), apart from text people wrote or stored: those
 * elements carry `data-user-content` (brief, package text, chat messages, review) and the binding agreement is the Uzbek
 * text on purpose.
 */
async function uzbekLeftovers(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest("script, style, noscript, textarea, [data-user-content], [data-testid='agreement-uz']")) continue;
      if (/[ʻʼ]/.test(n.textContent ?? "")) found.push((n.textContent ?? "").trim().slice(0, 80));
    }
    // Attributes a reader meets: labels, placeholders, titles, link names.
    for (const el of Array.from(document.body.querySelectorAll("[aria-label], [placeholder], [title], [alt]"))) {
      if (el.closest("[data-user-content], [data-testid='agreement-uz']")) continue;
      for (const a of ["aria-label", "placeholder", "title", "alt"]) {
        const v = el.getAttribute(a);
        // The language button names the OTHER language in that language's own word («Сменить язык: Oʻzbekcha»), on purpose.
        if (v && /[ʻʼ]/.test(v) && !v.startsWith("Сменить язык: ")) found.push(`[${a}] ${v.slice(0, 80)}`);
      }
    }
    return found;
  });
}

const tilesOf = (page: Page) => page.locator("dl dt");
const rowOf = (page: Page, id: string) => page.locator(`a[href="/orders/${id}"]`);
const statusBadges = (page: Page) => page.getByTestId("order-status");

test.describe("Russian off (the live site today)", () => {
  const ASKING = { "x-locale": "ru" };

  test("a signed-in client and creator see only Uzbek, even when the request asks for Russian", async ({ browser }) => {
    const w = await newWorld(UZ_BASE);
    const requested = await orderAt(w, "REQUESTED");
    const pending = await orderAt(w, "AGREEMENT_PENDING");
    const waiting = await orderAt(w, "AWAITING_PAYMENT");
    const jasurHome = await signedIn(UZ_BASE, "jasur@demo.test");

    for (const [ctx, path] of [
      [w.client, "/dashboard/client"], [w.client, "/orders/new?service=" + w.serviceId], [w.client, `/orders/${requested}`], [w.client, `/orders/${pending}`],
      [w.client, `/checkout/${waiting}`], [w.client, "/messages"], [jasurHome, "/dashboard/provider"], [jasurHome, "/dashboard/provider/profile/wizard"], [jasurHome, `/orders/${requested}`],
    ] as const) {
      const { page, context } = await pageFor(browser, ctx, UZ_BASE, "ru"); // the cookie asks for Russian
      await context.setExtraHTTPHeaders(ASKING);
      await page.goto(path);
      await settled(page);
      const where = path;
      await expect(page.locator("html"), where).toHaveAttribute("lang", "uz");
      expect(await page.locator("main").innerText(), where).not.toMatch(CYRILLIC);
      await expect(page.getByTestId("agreement-ru"), where).toHaveCount(0);
      await context.close();
    }
    // The agreement is the Uzbek text alone.
    const { page, context } = await pageFor(browser, w.client, UZ_BASE, "ru");
    await page.goto(`/orders/${pending}`);
    await expect(page.getByTestId("agreement-uz")).toBeVisible();
    await expect(page.getByTestId("agreement-ru")).toHaveCount(0);
    await context.close();
  });

  test("an order action and a field check answer in Uzbek, whatever the request asks for", async () => {
    const w = await newWorld(UZ_BASE);
    const id = await orderAt(w, "REQUESTED");
    const field = await w.jasur.post(`/api/orders/${id}/propose`, { headers: ASKING, data: { price: 5 } });
    expect(field.status()).toBe(400);
    expect(await field.json()).toMatchObject({ error: "Belgilangan maydonlarni tekshiring.", fieldErrors: { price: ["Eng kam narx — 20 000 soʻm"], deliveryDays: ["Kunlar sonini kiriting"] } });
    const wrongStep = await w.client.post(`/api/orders/${id}/approve`, { headers: ASKING });
    expect(wrongStep.status()).toBe(409);
    expect((await wrongStep.json()).error).toBe("Buyurtma holatini hozir bunday oʻzgartirib boʻlmaydi. Sahifani yangilab, qayta urinib koʻring.");
  });
});

test.describe("Russian on (second copy of the build, RUSSIAN_LIVE=1)", () => {
  test.skip(!RU_BASE, "E2E_RU_BASE_URL is not set: run through the production-style rig (scripts/e2e-prod/README.md).");
  test.use({ baseURL: RU_BASE });
  const BASE = RU_BASE!;
  const ASKING = { "x-locale": "ru" };

  test("the client's cabinet: greeting, tiles, and every order in its own status with its next step", async ({ browser }) => {
    const w = await newWorld(BASE);
    const ids: Record<Status, string> = {} as Record<Status, string>;
    for (const s of ["REQUESTED", "AGREEMENT_PENDING", "AWAITING_PAYMENT", "IN_PROGRESS", "DELIVERED", "COMPLETED", "CANCELLED", "DISPUTED"] as const) ids[s] = await orderAt(w, s);

    const { page, context } = await pageFor(browser, w.client, BASE);
    const problems = watchConsole(page);
    await page.goto("/dashboard/client");
    await settled(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page).toHaveTitle("Кабинет заказчика · Tarmoq.uz");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Здравствуйте, E2E!");
    await expect(page.getByRole("link", { name: "Найти креатора" })).toBeVisible();
    await expect(tilesOf(page)).toHaveText(["Активные заказы", "Ждут ваших действий", "Завершённые"]);
    await expect(page.getByRole("heading", { level: 2, name: "Ваши заказы" })).toBeVisible();

    // Eight orders, eight different statuses, each with its next step for a client (one row per order).
    const expected: [Status, string, string][] = [
      ["REQUESTED", "Заявка отправлена", "Дождитесь условий от креатора"],
      ["AGREEMENT_PENDING", "Ожидается соглашение", "Изучите условия и примите их"],
      ["AWAITING_PAYMENT", "Ожидается оплата", "Оплатите заказ, чтобы работа началась"],
      ["IN_PROGRESS", "В работе", "Креатор работает над вашим видео"],
      ["DELIVERED", "Работа сдана", "Посмотрите сданную работу и примите её"],
      ["COMPLETED", "Завершён", "Оставьте отзыв"],
      ["CANCELLED", "Отменён", "Заказ отменён"],
      ["DISPUTED", "В споре", "Администратор рассматривает спор"],
    ];
    for (const [status, badge, action] of expected) {
      const row = rowOf(page, ids[status]);
      await expect(row.getByTestId("order-status"), status).toHaveText(badge);
      await expect(row, status).toContainText(action);
      await expect(row, status).toContainText("с Jasur Karimov");
    }
    await expect(rowOf(page, ids.AWAITING_PAYMENT)).toContainText(/Обновлено: \d{1,2} [а-я]+ 20\d\d/);
    await expect(rowOf(page, ids.AWAITING_PAYMENT)).toContainText(money(300000));
    expect(await uzbekLeftovers(page)).toEqual([]);
    expect(problems).toEqual([]);
    await context.close();
  });

  test("the new-order page: the package, its facts and the form", async ({ browser }) => {
    const w = await newWorld(BASE);
    const { page, context } = await pageFor(browser, w.client, BASE);
    const problems = watchConsole(page);
    await page.goto(`/orders/new?service=${w.serviceId}`);
    await settled(page);
    await expect(page).toHaveTitle("Новый заказ · Tarmoq.uz");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Заказ: ");
    await expect(page.getByText(/^Срок: \d+ дн\.$/)).toBeVisible();
    await expect(page.getByText(/^\d+ (правка|правки|правок)$/)).toBeVisible();
    await expect(page.getByLabel("Опишите, что нужно")).toBeVisible();
    await expect(page.getByLabel("Дата мероприятия или съёмки (необязательно)")).toBeVisible();
    await expect(page.getByText("Оплата на следующей странице. До оплаты и вы, и креатор можете предложить изменить условия.")).toBeVisible();
    await page.locator("form input[type=checkbox]").check(); // the terms: without them the button stays off

    // A field error from the server, in Russian: the brief is too short.
    await page.getByLabel("Опишите, что нужно").fill("Коротко");
    await page.getByRole("button", { name: "Купить" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("Проверьте отмеченные поля.");
    await expect(page.getByText("Опишите, что нужно (не менее 20 символов)")).toBeVisible();

    // A date in the past: a server error with a field.
    await page.getByLabel("Опишите, что нужно").fill(goodBrief);
    await page.getByLabel("Дата мероприятия или съёмки (необязательно)").fill("2020-01-01");
    await page.getByRole("button", { name: "Купить" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("Дата мероприятия не может быть в прошлом.");

    // And the real thing: the order is placed from this page.
    await page.getByLabel("Дата мероприятия или съёмки (необязательно)").fill("");
    await page.getByRole("button", { name: "Купить" }).click();
    await expect(page).toHaveURL(/\/checkout\/[a-z0-9]+$/);
    await page.goto(page.url().replace("/checkout/", "/orders/"));
    await expect(statusBadges(page)).toHaveText("Ожидается оплата");
    expect(await uzbekLeftovers(page)).toEqual([]);
    expect(problems).toEqual([]);
    await context.close();
  });

  test("an order page in every status: badge, timeline, next step and the actions, for the client and for the creator", async ({ browser }) => {
    const w = await newWorld(BASE);
    const STEPS = ["Заявка", "Условия согласованы", "Оплачено", "Работа сдана", "Завершён"];
    const table: { status: Status; badge: string; client: string; creator: string; clientSees: string[]; creatorSees: string[] }[] = [
      { status: "REQUESTED", badge: "Заявка отправлена", client: "Дождитесь условий от креатора", creator: "Отправьте свои условия", clientSees: ["Отменить заказ"], creatorSees: ["Отправьте свои условия", "Отправить условия заказчику", "Отклонить заявку"] },
      { status: "AGREEMENT_PENDING", badge: "Ожидается соглашение", client: "Изучите условия и примите их", creator: "Дождитесь, пока заказчик примет условия", clientSees: ["Принять соглашение", "Отменить заказ"], creatorSees: ["Обновить условия", "Отправить обновлённые условия"] },
      { status: "AWAITING_PAYMENT", badge: "Ожидается оплата", client: "Оплатите заказ, чтобы работа началась", creator: "Дождитесь оплаты от заказчика", clientSees: ["Оплатить", "Хотите остановить заказ?"], creatorSees: ["Отменить заказ"] },
      { status: "IN_PROGRESS", badge: "В работе", client: "Креатор работает над вашим видео", creator: "Загрузите готовое видео", clientSees: ["Открыть спор", "Хотите остановить заказ?"], creatorSees: ["Сдача видео", "Сдать работу", "Открыть спор"] },
      { status: "DELIVERED", badge: "Работа сдана", client: "Посмотрите сданную работу и примите её", creator: "Дождитесь, пока заказчик примет работу", clientSees: ["Сданная работа", "Принять работу и перевести оплату", "Запросить правки (осталось: 1)", "Скачать"], creatorSees: ["Сданная работа", "Скачать"] },
      { status: "COMPLETED", badge: "Завершён", client: "Оставьте отзыв", creator: "Завершён", clientSees: ["Оставьте отзыв", "Отправить отзыв", "Транзакция", "Переведено креатору"], creatorSees: ["Транзакция", "Комиссия платформы", "Доход креатора"] },
      { status: "CANCELLED", badge: "Отменён", client: "Заказ отменён", creator: "Заказ отменён", clientSees: ["Этот заказ отменён. Оплата не удерживается."], creatorSees: ["Этот заказ отменён. Оплата не удерживается."] },
      { status: "DISPUTED", badge: "В споре", client: "Администратор рассматривает спор", creator: "Администратор рассматривает спор", clientSees: ["Этот заказ в споре. Администратор решит, перевести оплату креатору или вернуть заказчику."], creatorSees: ["Этот заказ в споре. Администратор решит, перевести оплату креатору или вернуть заказчику."] },
    ];
    const clientPage = await pageFor(browser, w.client, BASE);
    const creatorPage = await pageFor(browser, w.jasur, BASE);
    const problems = [...[watchConsole(clientPage.page)], ...[watchConsole(creatorPage.page)]];
    for (const c of table) {
      const id = await orderAt(w, c.status);
      for (const [who, p, next, sees] of [["client", clientPage.page, c.client, c.clientSees], ["creator", creatorPage.page, c.creator, c.creatorSees]] as const) {
        const where = `${c.status} as the ${who}`;
        await p.goto(`/orders/${id}`);
        await settled(p);
        await expect(p.locator("html"), where).toHaveAttribute("lang", "ru");
        await expect(p).toHaveTitle("Заказ · Tarmoq.uz");
        await expect(statusBadges(p), where).toHaveText(c.badge);
        await expect(p.getByRole("list", { name: "Ход заказа" }).locator("li"), where).toContainText(STEPS);
        await expect(p.getByText("Следующий шаг:"), where).toContainText(next);
        for (const text of sees) await expect(p.getByText(text, { exact: true }).first(), `${where}: ${text}`).toBeVisible();
        expect(await uzbekLeftovers(p), where).toEqual([]);
      }
    }
    expect(problems.flat()).toEqual([]);
    await clientPage.context.close();
    await creatorPage.context.close();
  });

  test("the agreement: a labelled Russian reading above the binding Uzbek text, with the same figures", async ({ browser }) => {
    const w = await newWorld(BASE);
    const id = await orderAt(w, "AGREEMENT_PENDING");
    for (const [name, ctx] of [["client", w.client], ["creator", w.jasur]] as const) {
      const { page, context } = await pageFor(browser, ctx, BASE);
      await page.goto(`/orders/${id}`);
      await settled(page);
      await expect(page.getByRole("heading", { level: 2, name: "Соглашение (версия 1)" }), name).toBeVisible();
      const ru = page.getByTestId("agreement-ru");
      const uz = page.getByTestId("agreement-uz");
      await expect(ru, name).toBeVisible();
      await expect(ru.getByText("Информационный перевод. Обязательным является текст на узбекском языке ниже."), name).toBeVisible();
      await expect(ru.getByText("Обязательный текст (на узбекском)"), name).toBeVisible();
      await expect(uz, name).toHaveAttribute("lang", "uz");
      await expect(uz, name).toContainText("XIZMAT KOʻRSATISH KELISHUVI (1-versiya)");
      await expect(uz, name).toContainText("Toʻlov oldindan amalga oshiriladi");

      // It sits ABOVE the binding text, in the page and on the screen.
      const [ruBox, uzBox] = [await ru.boundingBox(), await uz.boundingBox()];
      expect(ruBox!.y + ruBox!.height, name).toBeLessThanOrEqual(uzBox!.y + 1);
      expect(await ru.evaluate((r, u) => !!(r.compareDocumentPosition(u!) & Node.DOCUMENT_POSITION_FOLLOWING), await uz.elementHandle()), name).toBe(true);

      // The same figures: every number in the Russian reading is, in order, the number in the Uzbek text.
      const numbers = (t: string) => (t.match(/\d+(?:[\u00a0 ]\d{3})*/g) ?? []).map((n) => n.replace(/[\u00a0 ]/g, ""));
      const ruText = await ru.locator("pre").innerText();
      const uzText = await uz.innerText();
      expect(numbers(ruText), name).toEqual(numbers(uzText));
      expect(ruText, name).toContain("заказчик E2E Tester и креатор Jasur Karimov");
      expect(ruText, name).toContain("Ikki joy\nChilonzor, soat 18:00"); // what the creator wrote stays as written
      expect(ruText, name).toMatch(/Цена: 300\s000\sсум\./);
      expect(ruText, name).toContain("Комиссия платформы: 10% от цены, но не менее");
      expect(ruText, name).not.toContain("soʻm");
      expect(await uzbekLeftovers(page), name).toEqual([]);
      await context.close();
    }

    // Accepting, in Russian: the checkbox and the button, then the next status.
    const { page, context } = await pageFor(browser, w.client, BASE);
    await page.goto(`/orders/${id}`);
    await settled(page);
    await page.getByLabel("Условия прочитаны, я их принимаю").check();
    await page.getByRole("button", { name: "Принять соглашение" }).click();
    await expect(statusBadges(page)).toHaveText("Ожидается оплата");
    await expect(page.getByText(/Заказчик принял условия: \d{1,2} [а-я]+, \d\d:\d\d/)).toBeVisible();
    await expect(page.getByText(/Креатор принял условия: \d{1,2} [а-я]+, \d\d:\d\d/)).toBeVisible();
    await context.close();
  });

  test("after the creator sends new terms the Russian reading follows the new version", async ({ browser }) => {
    // The Russian reading is made from the stored text of the latest agreement (and shown only when it can be proved to match).
    const w = await newWorld(BASE);
    const id = await orderAt(w, "AGREEMENT_PENDING");
    await ok(await w.jasur.post(`/api/orders/${id}/propose`, { data: { price: 450000, deliveryDays: 5, revisions: 2 } }), "re-propose");
    const { page, context } = await pageFor(browser, w.client, BASE);
    await page.goto(`/orders/${id}`);
    await expect(page.getByRole("heading", { level: 2, name: "Соглашение (версия 2)" })).toBeVisible();
    await expect(page.getByTestId("agreement-ru").locator("pre")).toContainText("Цена: 450");
    await expect(page.getByTestId("agreement-ru").locator("pre")).toContainText("5 дн.");
    await expect(page.getByTestId("agreement-ru").locator("pre")).toContainText("Правки: включено правок: 2.");
    await expect(page.getByTestId("agreement-ru").locator("pre")).toContainText("Пояснение к объёму работы: Нет.");
    await expect(page.getByTestId("agreement-uz")).toContainText("2 ta tuzatish kiritilgan");
    await context.close();
  });

  test("checkout in Russian: the card form, a declined card, a check on the form, and paying", async ({ browser }) => {
    const w = await newWorld(BASE);
    const id = await orderAt(w, "AWAITING_PAYMENT");
    const { page, context } = await pageFor(browser, w.client, BASE);
    const problems = watchConsole(page);
    await page.goto(`/checkout/${id}`);
    await settled(page);
    await expect(page).toHaveTitle("Оплата · Tarmoq.uz");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Оплата");
    await expect(page.getByText("с Jasur Karimov")).toBeVisible();
    await expect(page.getByText(money(300000)).first()).toBeVisible();
    await expect(page.getByText("Деньги удерживаются, пока вы не примете готовое видео.")).toBeVisible();
    await expect(page.getByText(/тестовый режим/i)).toHaveCount(0);
    await expect(page.getByLabel("Номер карты")).toBeVisible();
    await expect(page.getByLabel("Срок действия (ММ/ГГ)")).toBeVisible();
    await expect(page.getByLabel("Код безопасности (CVC)")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Заполнить: / })).toHaveText(["Заполнить: Успешная", "Заполнить: Отклонённая", "Заполнить: Недостаточно средств"]);

    // A check made in the browser.
    await page.getByRole("button", { name: /^Оплатить / }).click();
    await expect(page.getByText("Введите номер карты.")).toBeVisible();
    await expect(page.getByText("Введите в формате ММ/ГГ.")).toBeVisible();
    await expect(page.getByText("Введите трёхзначный код.")).toBeVisible();

    // The server's answer to a declined card, in Russian (a returned answer, not a thrown one).
    await page.getByRole("button", { name: "Заполнить: Отклонённая" }).click();
    await page.getByRole("button", { name: /^Оплатить / }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("Карта отклонена.");
    await page.getByRole("button", { name: "Заполнить: Недостаточно средств" }).click();
    await page.getByRole("button", { name: /^Оплатить / }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("На карте недостаточно средств.");
    expect(await uzbekLeftovers(page)).toEqual([]);

    // Paying.
    await page.getByRole("button", { name: "Заполнить: Успешная" }).click();
    await page.getByRole("button", { name: /^Оплатить / }).click();
    await expect(page).toHaveURL(/paid=1/);
    await expect(page.getByText("Оплата подтверждена. Теперь креатор может приступить к работе.")).toBeVisible();
    await expect(statusBadges(page)).toHaveText("В работе");
    await expect(page.getByText(/visa •••• 4242/)).toBeVisible();
    expect(problems).toEqual([]);
    await context.close();
  });

  test("the card sentences come in Russian from the API as well, and an Uzbek request still gets Uzbek", async () => {
    const w = await newWorld(BASE);
    const id = await orderAt(w, "AWAITING_PAYMENT");
    const payment = (await ok(await w.client.post("/api/payments/sandbox/intent", { data: { orderId: id } }), "intent")).payment as { id: string };
    const card = { orderId: id, paymentId: payment.id, expMonth: 12, expYear: 2034, cvc: "123" };
    const declined = await w.client.post("/api/payments/sandbox/confirm", { headers: ASKING, data: { ...card, cardNumber: "4000 0000 0000 0002" } });
    expect(declined.status()).toBe(402);
    expect(await declined.json()).toEqual({ error: "Карта отклонена.", code: "card_declined" });
    const fresh = (await ok(await w.client.post("/api/payments/sandbox/intent", { data: { orderId: id } }), "intent")).payment as { id: string };
    const uz = await w.client.post("/api/payments/sandbox/confirm", { data: { ...card, paymentId: fresh.id, cardNumber: "4000 0000 0000 0002" } });
    expect((await uz.json()).error).toBe("Karta rad etildi.");
    const bad = await w.client.post("/api/payments/sandbox/confirm", { headers: ASKING, data: { ...card, paymentId: fresh.id, cardNumber: "12", cvc: "1" } });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).error).toBe("Проверьте отмеченные поля.");
  });

  test("validation and server errors on order actions arrive in Russian, in the page and from the API", async ({ browser }) => {
    const w = await newWorld(BASE);
    const requested = await orderAt(w, "REQUESTED");
    const delivered = await orderAt(w, "DELIVERED");
    const completed = await orderAt(w, "COMPLETED");

    // The creator's terms form: two field errors from the server's zod messages.
    const creator = await pageFor(browser, w.jasur, BASE);
    await creator.page.goto(`/orders/${requested}`);
    await settled(creator.page);
    await creator.page.getByLabel("Цена (сум)").fill("5");
    await creator.page.getByLabel("Срок (дни)").fill("");
    await creator.page.getByRole("button", { name: "Отправить условия заказчику" }).click();
    await expect(creator.page.locator("form").getByRole("alert")).toHaveText("Проверьте отмеченные поля.");
    await expect(creator.page.getByText("Минимальная цена: 20 000 сум")).toBeVisible();
    await expect(creator.page.getByText("Укажите количество дней")).toBeVisible();
    await creator.context.close();

    // The review form: no stars and a short text.
    const client = await pageFor(browser, w.client, BASE);
    await client.page.goto(`/orders/${completed}`);
    await settled(client.page);
    await client.page.getByLabel("Ваш отзыв").fill("Хорошо");
    await client.page.getByRole("button", { name: "Отправить отзыв" }).click();
    await expect(client.page.getByText("Выберите оценку")).toBeVisible();
    await expect(client.page.getByText("Напишите не менее 10 символов")).toBeVisible();
    await expect(client.page.getByRole("radio", { name: "Оценка 5 из 5" })).toBeVisible();

    // A stale page: the work was approved from another tab, so pressing the button now is refused, in Russian.
    await client.page.goto(`/orders/${delivered}`);
    await settled(client.page);
    await ok(await w.client.post(`/api/orders/${delivered}/approve`), "approve elsewhere");
    await client.page.getByRole("button", { name: "Принять работу и перевести оплату" }).click();
    await expect(client.page.locator("main").getByRole("alert")).toHaveText("Сейчас так изменить статус заказа нельзя. Обновите страницу и попробуйте ещё раз.");

    // The dispute form needs a reason.
    const inProgress = await orderAt(w, "IN_PROGRESS");
    await client.page.goto(`/orders/${inProgress}`);
    await settled(client.page);
    await client.page.getByRole("button", { name: "Открыть спор" }).click();
    await client.page.getByRole("button", { name: "Отправить спор" }).click();
    await expect(client.page.getByText("Опишите проблему (не менее 10 символов)")).toBeVisible();
    await client.context.close();

    // The same errors straight from the API, for a request that asks for Russian.
    const api = await w.client.post(`/api/orders/${requested}/approve`, { headers: ASKING });
    expect(api.status()).toBe(409);
    expect((await api.json()).error).toBe("Сейчас так изменить статус заказа нельзя. Обновите страницу и попробуйте ещё раз.");
    const missing = await w.client.post("/api/orders/zzzzzz/cancel", { headers: ASKING, data: {} });
    expect((await missing.json()).error).toBe("Заказ не найден.");
  });

  test("messages and the chat: the list, the unread badge, sending, and a message that is too long", async ({ browser }) => {
    const w = await newWorld(BASE);
    const id = await orderAt(w, "AWAITING_PAYMENT", "Kafe uchun reel kerak. Oʻzbekcha va ruscha subtitr.");
    // The creator's side has an unread conversation (the client's first message).
    const creator = await pageFor(browser, w.jasur, BASE);
    const problems = watchConsole(creator.page);
    await creator.page.goto("/messages");
    await settled(creator.page);
    await expect(creator.page).toHaveTitle("Сообщения · Tarmoq.uz");
    await expect(creator.page.getByRole("heading", { level: 1 })).toHaveText("Сообщения");
    const link = creator.page.locator("ul a", { hasText: "E2E Tester" }).first();
    await expect(link.getByLabel(/^Непрочитанных: \d+$/)).toBeVisible();
    expect(await uzbekLeftovers(creator.page)).toEqual([]); // the stored first message is user content

    const conversationId = (await (await w.client.get("/api/conversations")).json()).conversations.find((c: { orderId: string | null }) => c.orderId === id).id as string;
    await creator.page.goto(`/messages/${conversationId}`);
    await settled(creator.page);
    await expect(creator.page).toHaveTitle("Чат · Tarmoq.uz");
    await expect(creator.page.getByRole("link", { name: "Все сообщения" })).toBeVisible();
    await expect(creator.page.getByRole("link", { name: "Открыть заказ" })).toBeVisible();
    await expect(creator.page.getByLabel("Сообщение", { exact: true })).toBeVisible();
    await expect(creator.page.getByPlaceholder("Сообщение (Enter: отправить, Shift+Enter: новая строка)")).toBeVisible();
    await expect(creator.page.getByRole("button", { name: "Отправить" })).toBeDisabled();
    await expect(creator.page.getByText("Kafe uchun reel kerak.")).toBeVisible(); // the stored message stays as written

    await creator.page.getByLabel("Сообщение", { exact: true }).fill("Здравствуйте! Условия отправлю сегодня.");
    await creator.page.getByRole("button", { name: "Отправить" }).click();
    await expect(creator.page.getByText("Здравствуйте! Условия отправлю сегодня.")).toBeVisible();
    await expect(creator.page.getByText(/\d{1,2} [а-я]+, \d\d:\d\d/).last()).toBeVisible(); // the time of the message, in Russian
    // Too long: the server's field message, in Russian.
    await creator.page.getByLabel("Сообщение", { exact: true }).fill("я".repeat(2001));
    await creator.page.getByRole("button", { name: "Отправить" }).click();
    await expect(creator.page.locator("main").getByRole("alert")).toHaveText("Сообщение не должно быть длиннее 2000 символов");
    expect(await uzbekLeftovers(creator.page)).toEqual([]);
    expect(problems).toEqual([]);
    await creator.context.close();

    // A client with no conversations sees the empty state (and a creator's own wording).
    const lonely = await registered(BASE, "CLIENT");
    const empty = await pageFor(browser, lonely.ctx, BASE);
    await empty.page.goto("/messages");
    await expect(empty.page.getByText("Чатов пока нет")).toBeVisible();
    await expect(empty.page.getByText("Напишите креатору из его профиля или закажите. Подробности вы обсудите здесь.")).toBeVisible();
    await expect(empty.page.getByRole("link", { name: "Найти креаторов" })).toBeVisible();
    await empty.context.close();
  });

  test("the creator's cabinet and the payout card form", async ({ browser }) => {
    const w = await newWorld(BASE);
    await orderAt(w, "REQUESTED");
    const { page, context } = await pageFor(browser, w.jasur, BASE);
    const problems = watchConsole(page);
    await page.goto("/dashboard/provider");
    await settled(page);
    await expect(page).toHaveTitle("Кабинет креатора · Tarmoq.uz");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Кабинет креатора");
    await expect(page.getByText("Ваш профиль активен.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Посмотреть публичный профиль" })).toBeVisible();
    await expect(tilesOf(page)).toHaveText(["Новые заявки", "В работе", "Удерживаемые средства", "Полученный доход (без комиссии)", "Просмотры профиля", "Выполненные заказы", "Средняя оценка", "Доля завершённых"]);
    await expect(page.getByRole("heading", { level: 2, name: "Получение денег" })).toBeVisible();
    await expect(page.getByText("Когда заказчик примет работу, ваш доход (без комиссии) будет переведён на эту карту.")).toBeVisible();
    await expect(page.getByLabel("Владелец карты")).toBeVisible();
    await expect(page.getByPlaceholder("IVAN IVANOV")).toBeVisible();
    await expect(page.getByLabel("Номер карты")).toBeVisible();
    await expect(page.getByText("Как написано на карте")).toBeVisible();
    await expect(page.getByText("Хранится на сервере в зашифрованном виде")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Заказы" })).toBeVisible();
    await expect(statusBadges(page).first()).toBeVisible();

    // Field errors from the server, in Russian.
    await page.getByRole("button", { name: /^(Сохранить|Обновить) карту$/ }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("Проверьте отмеченные поля.");
    await expect(page.getByText("Введите имя владельца карты")).toBeVisible();
    await expect(page.getByText("Введите номер карты", { exact: true })).toBeVisible();
    await page.getByLabel("Владелец карты").fill("JASUR KARIMOV");
    await page.getByLabel("Номер карты").fill("1234");
    await page.getByRole("button", { name: /^(Сохранить|Обновить) карту$/ }).click();
    await expect(page.getByText("Введите правильный номер карты (16 цифр)")).toBeVisible();
    expect(await uzbekLeftovers(page)).toEqual([]);
    expect(problems).toEqual([]);
    await context.close();
  });

  test("the profile wizard: Russian steps and names, and the stored Uzbek values go to the server", async ({ browser }) => {
    const { ctx, email } = await registered(BASE, "PROVIDER", "Dilnoza Test");
    const { page, context } = await pageFor(browser, ctx, BASE);
    const problems = watchConsole(page);
    await page.goto("/dashboard/provider");
    await settled(page);
    await expect(page.getByText("Профиль ещё не отправлен. Чтобы начать получать заказы,")).toBeVisible();
    await page.getByRole("link", { name: "заполните профиль" }).click();
    await settled(page);
    await expect(page).toHaveTitle("Ваш профиль креатора · Tarmoq.uz");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ваш профиль креатора");
    await expect(page.locator("ol button")).toHaveText(["1. Основное", "2. Локация", "3. Пакеты", "4. Портфолио", "5. Проверка"]);

    // Step 1: the categories are shown by their Russian names; the value sent is the category's id, as before.
    const categories = page.getByLabel("Направление");
    await expect(categories.locator("option")).toHaveText(["Выберите…", "Видеомонтаж", "Мобильная съёмка", "Съёмка с дрона", "Фотография"]); // in Russian alphabetical order
    await page.getByLabel("Заголовок").fill("Мобильный видеограф для Reels и мероприятий");
    await page.getByLabel("О себе").fill("Снимаю и монтирую вертикальные ролики для кафе, магазинов и мероприятий уже пять лет. Работаю быстро и аккуратно.");
    await categories.selectOption({ label: "Мобильная съёмка" });
    const step1 = page.waitForRequest((r) => r.url().endsWith("/api/profile") && r.method() === "PUT");
    await page.getByRole("button", { name: "Сохранить и продолжить" }).click();
    const body1 = (await step1).postDataJSON() as { step: number; data: { categoryId: string; headline: string } };
    expect(body1.step).toBe(1);
    expect(body1.data.headline).toBe("Мобильный видеограф для Reels и мероприятий");
    const mobileId = await categories.evaluate((el) => (el as HTMLSelectElement).selectedOptions[0]!.value);
    expect(body1.data.categoryId).toBe(mobileId);
    await expect(page.getByText("Сохранено.")).toBeVisible();

    // Step 2: cities and languages in Russian, values in Uzbek.
    const cities = page.getByLabel("Город");
    expect(await cities.locator("option").allInnerTexts()).toEqual(["Андижан", "Ташкент", "Самарканд", "Бухара", "Наманган", "Фергана", "Коканд", "Нукус", "Карши", "Термез"]);
    expect(await cities.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))).toEqual(
      ["Andijon", "Toshkent", "Samarqand", "Buxoro", "Namangan", "Fargʻona", "Qoʻqon", "Nukus", "Qarshi", "Termiz"],
    );
    await expect(page.getByText("На каких языках вы работаете?")).toBeVisible();
    await expect(page.locator("fieldset label")).toHaveText(["Узбекский", "Русский", "Английский", "Каракалпакский", "Таджикский"]);
    await cities.selectOption({ label: "Ташкент" });
    await page.getByLabel("Район (необязательно)").fill("Чиланзар");
    await page.locator("fieldset label", { hasText: "Русский" }).locator("input").check();
    await page.locator("fieldset label", { hasText: "Узбекский" }).locator("input").check();
    const step2 = page.waitForRequest((r) => r.url().endsWith("/api/profile") && r.method() === "PUT");
    await page.getByRole("button", { name: "Сохранить и продолжить" }).click();
    const body2 = (await step2).postDataJSON() as { step: number; data: { city: string; languages: string[]; district: string } };
    expect(body2.data.city).toBe("Toshkent");
    expect(body2.data.languages.sort()).toEqual(["Oʻzbek", "Rus"]);
    expect(body2.data.district).toBe("Чиланзар"); // what the creator typed is sent as typed

    // Step 3: a package, with its Russian labels and a server field error.
    await expect(page.getByRole("heading", { level: 3, name: "Пакет 1" })).toBeVisible();
    await page.getByRole("button", { name: "Сохранить и продолжить" }).click();
    await expect(page.getByText("Введите название")).toBeVisible();
    await expect(page.getByText("Напишите, что входит в пакет (не менее 10 символов)")).toBeVisible();
    await expect(page.getByText("Укажите цену").first()).toBeVisible();
    await page.getByLabel("Название").fill("Reels за один день");
    await page.getByLabel("Что входит?").fill("Съёмка до двух часов и монтаж одного вертикального ролика.");
    await page.getByLabel("Цена (сум)").fill("250000");
    await page.getByRole("button", { name: "Сохранить и продолжить" }).click();
    await expect(page.getByText("Добавьте ссылки на лучшие работы (YouTube, Instagram, Google Drive или изображение). Ссылки должны начинаться с https://.")).toBeVisible();

    // Step 4 and 5: the portfolio, then the check, in Russian with Russian names of the stored values.
    await page.getByLabel("Название").fill("Рилс для кафе");
    await page.getByLabel("Ссылка на видео").fill("http://example.com/reel");
    await page.getByRole("button", { name: "Сохранить и продолжить" }).click();
    await expect(page.getByText("Ссылка должна начинаться с https://")).toBeVisible();
    await page.getByLabel("Ссылка на видео").fill("https://example.com/reel");
    await page.getByRole("button", { name: "Сохранить и продолжить" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Проверьте профиль" })).toBeVisible();
    await expect(page.getByText("Локация", { exact: true })).toBeVisible();
    await expect(page.getByText("Ташкент, Чиланзар")).toBeVisible();
    await expect(page.getByText("Русский, Узбекский")).toBeVisible(); // in the order they were ticked
    await expect(page.getByText(new RegExp("Reels за один день: 250\\s000\\sсум"))).toBeVisible();
    await expect(page.getByText("Работы в портфолио")).toBeVisible();
    await expect(page.getByText("После отправки администратор проверит ваш профиль, и он появится в поиске.")).toBeVisible();
    expect(await uzbekLeftovers(page)).toEqual([]);
    await page.getByRole("button", { name: "Отправить на проверку" }).click();
    await expect(page.getByText("Отправлено. Администратор проверяет ваш профиль. После подтверждения вы появитесь в поиске.")).toBeVisible();
    expect(problems).toEqual([]);

    // What was saved is the Uzbek value: the wizard in Uzbek shows the city and the languages by their stored words.
    await context.addCookies([{ name: "lang", value: "uz", url: BASE }]);
    await page.goto("/dashboard/provider/profile/wizard");
    await settled(page);
    await page.getByRole("button", { name: /Joylashuv/ }).click();
    await expect(page.getByLabel("Shahar", { exact: true })).toHaveValue("Toshkent");
    await expect(page.locator("fieldset label", { hasText: "Rus" }).locator("input")).toBeChecked();
    await expect(page.locator("fieldset label", { hasText: "Oʻzbek" }).locator("input")).toBeChecked();
    await expect(page.locator("fieldset label", { hasText: "Ingliz" }).locator("input")).not.toBeChecked();
    await context.close();
    expect(email).toContain("@example.test");

    // The server's refusal of a bad value, for a request that asks for Russian.
    const bad = await ctx.put("/api/profile", { headers: ASKING, data: { step: 2, data: { city: "Ташкент", languages: ["Русский"] } } });
    expect(bad.status()).toBe(400);
    const json = await bad.json();
    expect(json.fieldErrors).toEqual({ city: ["Выберите город"], languages: expect.any(Array) });
  });

  test("a creator's refusals from the profile API are Russian too", async () => {
    const { ctx } = await registered(BASE, "PROVIDER", "Rustam Test");
    expect((await ctx.get("/api/providers")).status()).toBe(403); // a creator may not browse creators
    expect((await (await ctx.get("/api/providers", { headers: ASKING })).json()).error).toBe("У вас нет на это прав.");
    // A profile that has only step 1 cannot skip ahead.
    const wizard = await (await ctx.get("/dashboard/provider/profile/wizard", { headers: ASKING })).text();
    const categoryId = /<option value="([a-z0-9]{10,})"/.exec(wizard)?.[1];
    expect(categoryId).toBeTruthy();
    await ok(await ctx.put("/api/profile", { data: { step: 1, data: { headline: "Видеограф для мероприятий и Reels", bio: "x".repeat(60), categoryId } } }), "step 1");
    const early = await ctx.put("/api/profile", { headers: ASKING, data: { step: 5 } });
    expect(early.status()).toBe(409);
    expect((await early.json()).error).toBe("Сначала выполните предыдущий шаг.");
  });

  test("a sweep: on the pages of both roles there is no Uzbek apostrophe letter outside what people wrote, and no sideways scroll on a phone", async ({ browser }) => {
    const w = await newWorld(BASE);
    // User content with the letters Uzbek uses must not trip the sweep, but only inside the marked places.
    const brief = "Oʻzbekiston boʻylab sayohat haqida reel kerak, ikki kunlik syomka, ruscha va oʻzbekcha subtitr bilan.";
    const requested = await orderAt(w, "REQUESTED", brief);
    const pending = await orderAt(w, "AGREEMENT_PENDING", brief);
    const waiting = await orderAt(w, "AWAITING_PAYMENT", brief);
    const delivered = await orderAt(w, "DELIVERED", brief);
    const completed = await orderAt(w, "COMPLETED", brief);
    const disputed = await orderAt(w, "DISPUTED", brief);
    const cancelled = await orderAt(w, "CANCELLED", brief);
    await ok(await w.client.post(`/api/orders/${completed}/review`, { data: { rating: 5, comment: "Juda yaxshi, oʻz vaqtida topshirdi. Rahmat!" } }), "review");
    const conversation = (await (await w.client.get("/api/conversations")).json()).conversations.find((c: { orderId: string | null }) => c.orderId === waiting).id as string;
    await ok(await w.client.post(`/api/conversations/${conversation}/messages`, { data: { body: "Salom, oʻzbekcha yozaman." } }), "message");

    const client: string[] = ["/dashboard/client", "/messages", `/messages/${conversation}`, `/orders/new?service=${w.serviceId}`, `/checkout/${waiting}`,
      ...[requested, pending, waiting, delivered, completed, disputed, cancelled].map((id) => `/orders/${id}`)];
    const creator: string[] = ["/dashboard/provider", "/dashboard/provider/profile/wizard", "/messages", `/messages/${conversation}`,
      ...[requested, pending, waiting, delivered, completed, disputed, cancelled].map((id) => `/orders/${id}`)];

    for (const width of [1280, 390]) {
      for (const [ctx, paths, who] of [[w.client, client, "client"], [w.jasur, creator, "creator"]] as const) {
        const { page, context } = await pageFor(browser, ctx, BASE, "ru", { width, height: 900 });
        const problems = watchConsole(page);
        for (const path of paths) {
          const where = `${who} ${width}px ${path.replace(/[a-z0-9]{20,}/g, ":id")}`;
          await page.goto(path);
          await settled(page);
          await expect(page.locator("html"), where).toHaveAttribute("lang", "ru");
          expect(await uzbekLeftovers(page), where).toEqual([]);
          expect(await page.evaluate(() => document.documentElement.scrollWidth), `${where}: sideways scroll`).toBeLessThanOrEqual(width);
        }
        // The wizard's five steps, one by one (a creator whose profile is complete may walk all of them).
        if (who === "creator") {
          await page.goto("/dashboard/provider/profile/wizard");
          await settled(page);
          for (let n = 1; n <= 5; n++) {
            await page.locator("ol button").nth(n - 1).click();
            expect(await uzbekLeftovers(page), `wizard step ${n} ${width}px`).toEqual([]);
            expect(await page.evaluate(() => document.documentElement.scrollWidth), `wizard step ${n} ${width}px: sideways scroll`).toBeLessThanOrEqual(width);
          }
        }
        expect(problems, `${who} ${width}px`).toEqual([]);
        await context.close();
      }
    }
  });

  test("with the language switched back to Uzbek, the same pages are Uzbek again", async ({ browser }) => {
    const w = await newWorld(BASE);
    const id = await orderAt(w, "AGREEMENT_PENDING");
    const { page, context } = await pageFor(browser, w.client, BASE, "ru");
    await page.goto(`/orders/${id}`);
    await settled(page);
    await expect(statusBadges(page)).toHaveText("Ожидается соглашение");
    await expect(page.getByTestId("agreement-ru")).toBeVisible();
    await page.locator("header").getByRole("button", { name: /^Сменить язык: / }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "uz");
    await expect(statusBadges(page)).toHaveText("Kelishuv kutilmoqda");
    await expect(page.getByTestId("agreement-ru")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "Kelishuv (1-versiya)" })).toBeVisible();
    expect(await page.locator("main").innerText()).not.toMatch(CYRILLIC);
    await context.close();
  });
});
