import { test, expect } from "@playwright/test";
import { login, goodBrief } from "./helpers";

// The required end-to-end scenario, driven through the real UI.
test("client finds an Andijan mobile videographer, orders, agrees, pays (sandbox), gets the video, approves, and reviews", async ({ page, browser }) => {
  const email = `e2e-client-${Date.now()}@example.test`;

  // 1. Register as a client
  await page.goto("/register");
  await page.getByLabel("Full name").fill("E2E Client");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Passw0rd!x");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/search/);

  // 2. Search: Andijan + Mobile videography + price filter (only Jasur has a package between 250k and 350k)
  await page.getByLabel("City", { exact: true }).selectOption("Andijan");
  await page.getByLabel("Category", { exact: true }).selectOption({ label: "Mobile videography" });
  await page.getByLabel("Min price (UZS)").fill("250000");
  await page.getByLabel("Max price (UZS)").fill("350000");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("Jasur Karimov")).toBeVisible();
  await expect(page.getByText("Bobur Tursunov")).toHaveCount(0);
  await expect(page.getByText("Dilshod Rahimov")).toHaveCount(0);

  // 3. Open the profile and order the Reel package
  await page.getByRole("link", { name: /Jasur Karimov/ }).first().click();
  await expect(page.getByRole("heading", { name: "Jasur Karimov" })).toBeVisible();
  await page.locator("li", { hasText: "Instagram Reel" }).getByRole("link", { name: "Order" }).click();

  // 4. Create the order
  await page.getByLabel("Describe what you need").fill(goodBrief);
  await page.getByRole("button", { name: "Send order request" }).click();
  await expect(page).toHaveURL(/\/orders\/[a-z0-9]+$/);
  const orderUrl = page.url();
  await expect(page.getByTestId("order-status")).toHaveText("Requested");

  // 5. Provider sends terms (acceptance recorded)
  const providerCtx = await browser.newContext();
  const provider = await providerCtx.newPage();
  await login(provider, "jasur@demo.test");
  await provider.goto(orderUrl);
  await expect(provider.getByRole("heading", { name: "Send your terms" })).toBeVisible();
  await provider.getByRole("button", { name: "Send terms to client" }).click();
  await expect(provider.getByText("Agreement (version 1)")).toBeVisible();

  // 6. Client accepts the agreement
  await page.reload();
  await expect(page.getByText("Agreement (version 1)")).toBeVisible();
  await page.getByLabel("I have read and accept these terms").check();
  await page.getByRole("button", { name: "Accept agreement" }).click();
  await expect(page.getByTestId("order-status")).toHaveText("Awaiting payment");
  await expect(page.getByText(/Client accepted: \d{4}-/)).toBeVisible();

  // 7. Sandbox payment with the success test card
  await page.getByRole("link", { name: "Pay securely (sandbox)" }).click();
  await page.getByRole("button", { name: "Fill: Success" }).click();
  await page.getByRole("button", { name: /^Pay / }).click();
  await expect(page).toHaveURL(/paid=1/);
  await expect(page.getByText("Payment confirmed (sandbox)")).toBeVisible();
  await expect(page.getByTestId("order-status")).toHaveText("In progress");

  // 8. Provider uploads the video
  await provider.reload();
  await provider.getByLabel("Video file").setInputFiles({ name: "reel.mp4", mimeType: "video/mp4", buffer: Buffer.from("not a real video, but a valid upload for the test") });
  await provider.getByRole("button", { name: "Upload delivery" }).click();
  await expect(provider.getByTestId("order-status")).toHaveText("Delivered");

  // 9. Client receives the video, approves, and sees the completed transaction
  await page.reload();
  await expect(page.getByRole("heading", { name: "Delivery" })).toBeVisible();
  await expect(page.locator("video")).toBeVisible();
  await page.getByRole("button", { name: "Approve & release payment" }).click();
  await expect(page.getByTestId("order-status")).toHaveText("Completed");
  await expect(page.getByRole("heading", { name: "Transaction" })).toBeVisible();
  await expect(page.getByText("Released to provider")).toBeVisible();

  // 10. Review is saved and shows on the public profile
  await page.getByRole("radio", { name: "5 stars" }).click();
  await page.getByLabel("Your review").fill("Fast, friendly and the reel looks great.");
  await page.getByRole("button", { name: "Submit review" }).click();
  await expect(page.getByText("Fast, friendly and the reel looks great.")).toBeVisible();
  await page.goto("/providers/jasur-karimov");
  await expect(page.getByText("Fast, friendly and the reel looks great.")).toBeVisible();

  // 11. The provider sees fee and payout
  await provider.goto(orderUrl);
  await expect(provider.getByText("Provider payout")).toBeVisible();
  await providerCtx.close();
});
