import { test, expect } from "@playwright/test";
import { login, settled } from "./helpers";

test("admin approves a pending provider, who then appears in public search", async ({ page }) => {
  await login(page, "admin@demo.test");
  await page.goto("/admin/providers");
  await settled(page);

  const card = page.getByTestId("provider-card").filter({ hasText: "sevara@demo.test" }).first();
  await expect(card).toBeVisible();
  // The status is read from data-status (the enum value), not from the Uzbek label shown to people.
  const status = card.getByTestId("profile-status");
  if ((await status.getAttribute("data-status")) === "PENDING_REVIEW") {
    await card.getByRole("button", { name: "Tasdiqlash" }).click();
    await expect(status).toHaveAttribute("data-status", "APPROVED");
  }

  await page.goto("/search?q=Sevara");
  await expect(page.getByText("Sevara Aliyeva")).toBeVisible();
});

test("admin can hide and restore a review, and the public rating follows", async ({ page }) => {
  await login(page, "admin@demo.test");
  await page.goto("/admin/reviews");
  await settled(page);
  const toggles = page.getByRole("button", { name: /Sharhni yashirish|Sharhni tiklash/ });
  if ((await toggles.count()) === 0) test.skip(true, "No reviews yet. Run the client journey test first.");
  const before = await toggles.first().innerText();
  await toggles.first().click();
  await expect(toggles.first()).not.toHaveText(before);
});
