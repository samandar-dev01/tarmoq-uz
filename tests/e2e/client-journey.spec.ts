import { test, expect } from "@playwright/test";
import { login, goodBrief, settled } from "./helpers";

// The required end-to-end scenario, driven through the real UI (which is in Uzbek).
test("mijoz Andijondagi mobilografni topadi, buyurtma beradi, kelishadi, toʻlaydi (sinov), videoni oladi, qabul qiladi va sharh qoldiradi", async ({ page, browser }) => {
  const email = `e2e-client-${Date.now()}@example.test`;
  // Unique per run, so repeated runs against the same database never show two reviews with the same text.
  const review = `Tez, xushmuomala va reel juda yaxshi chiqdi. (${Date.now()})`;

  // 1. Register as a client
  await page.goto("/register");
  await settled(page);
  await page.getByLabel("Ism-familiya").fill("E2E Client");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Parol").fill("Passw0rd!x");
  await page.getByRole("button", { name: "Roʻyxatdan oʻtish" }).click();
  await expect(page).toHaveURL(/\/search/);

  // 2. Search: Andijon + Mobilografiya + price filter (only Jasur has a package between 250k and 350k)
  await page.getByLabel("Shahar", { exact: true }).selectOption("Andijon");
  await page.getByLabel("Yoʻnalish", { exact: true }).selectOption({ label: "Mobilografiya" });
  await page.getByLabel("Eng kam narx (soʻm)").fill("250000");
  await page.getByLabel("Eng yuqori narx (soʻm)").fill("350000");
  await page.getByRole("button", { name: "Filtrlarni qoʻllash" }).click();
  await expect(page.getByText("Jasur Karimov")).toBeVisible();
  await expect(page.getByText("Bobur Tursunov")).toHaveCount(0);
  await expect(page.getByText("Dilshod Rahimov")).toHaveCount(0);

  // 3. Open the profile and order the Reel package
  await page.getByRole("link", { name: /Jasur Karimov/ }).first().click();
  await expect(page.getByRole("heading", { name: "Jasur Karimov" })).toBeVisible();
  await page.locator("li", { hasText: "Instagram Reel" }).getByRole("link", { name: "Buyurtma berish" }).click();

  // 4. Create the order
  await settled(page);
  await page.getByLabel("Nima kerakligini yozing").fill(goodBrief);
  await page.getByRole("button", { name: "Buyurtma yuborish" }).click();
  await expect(page).toHaveURL(/\/orders\/[a-z0-9]+$/);
  const orderUrl = page.url();
  await expect(page.getByTestId("order-status")).toHaveText("Soʻrov yuborildi");

  // 5. Provider sends terms (acceptance recorded)
  const providerCtx = await browser.newContext();
  const provider = await providerCtx.newPage();
  await login(provider, "jasur@demo.test");
  await provider.goto(orderUrl);
  await settled(provider);
  await expect(provider.getByRole("heading", { name: "Shartlaringizni yuboring" })).toBeVisible();
  await provider.getByRole("button", { name: "Shartlarni mijozga yuborish" }).click();
  await expect(provider.getByText("Kelishuv (1-versiya)")).toBeVisible();

  // 6. Client accepts the agreement
  await page.reload();
  await settled(page);
  await expect(page.getByText("Kelishuv (1-versiya)")).toBeVisible();
  await page.getByLabel("Shartlar bilan tanishib chiqdim va qabul qilaman").check();
  await page.getByRole("button", { name: "Kelishuvni qabul qilish" }).click();
  await expect(page.getByTestId("order-status")).toHaveText("Toʻlov kutilmoqda");
  await expect(page.getByText(/Mijoz qabul qildi: \d{1,2}-/)).toBeVisible();

  // 7. Sandbox payment with the success test card
  await page.getByRole("link", { name: "Xavfsiz toʻlash (sinov rejimi)" }).click();
  await page.getByRole("button", { name: "Toʻldirish: Muvaffaqiyatli" }).click();
  await page.getByRole("button", { name: /toʻlash$/ }).click();
  await expect(page).toHaveURL(/paid=1/);
  await expect(page.getByText("Toʻlov tasdiqlandi (sinov rejimi)")).toBeVisible();
  await expect(page.getByTestId("order-status")).toHaveText("Jarayonda");

  // 8. Provider uploads the video
  await provider.reload();
  await settled(provider);
  await provider.getByLabel("Video fayl").setInputFiles({ name: "reel.mp4", mimeType: "video/mp4", buffer: Buffer.from("not a real video, but a valid upload for the test") });
  await provider.getByRole("button", { name: "Ishni topshirish" }).click();
  await expect(provider.getByTestId("order-status")).toHaveText("Topshirildi");

  // 9. Client receives the video, approves, and sees the completed transaction
  await page.reload();
  await settled(page);
  await expect(page.getByRole("heading", { name: "Topshirilgan ish" })).toBeVisible();
  await expect(page.locator("video")).toBeVisible();
  await page.getByRole("button", { name: "Qabul qilish va toʻlovni oʻtkazish" }).click();
  await expect(page.getByTestId("order-status")).toHaveText("Yakunlandi");
  await expect(page.getByRole("heading", { name: "Tranzaksiya" })).toBeVisible();
  await expect(page.getByText("Ijodkorga oʻtkazildi")).toBeVisible();

  // 10. Review is saved and shows on the public profile
  await page.getByRole("radio", { name: "5 yulduz" }).click();
  await page.getByLabel("Sharhingiz").fill(review);
  await page.getByRole("button", { name: "Sharhni yuborish" }).click();
  // The review is saved once the form gives way to the "Sharh" section. (The text alone is not proof: it also
  // matches the textarea the client just typed it into, and leaving the page now could cancel the save.)
  await expect(page.getByRole("heading", { name: "Sharh", exact: true })).toBeVisible();
  await expect(page.getByText(review)).toBeVisible();
  await page.goto("/providers/jasur-karimov");
  await expect(page.getByText(review)).toBeVisible();

  // 11. The provider sees fee and payout
  await provider.goto(orderUrl);
  await expect(provider.getByText("Ijodkor daromadi")).toBeVisible();
  await providerCtx.close();
});
