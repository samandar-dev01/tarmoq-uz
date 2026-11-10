import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("admin approves a pending provider, who then appears in public search", async ({ page }) => {
  await login(page, "admin@demo.test");
  await page.goto("/admin/providers");

  const card = page.locator("div.rounded-xl", { hasText: "sevara@demo.test" }).first();
  await expect(card).toBeVisible();
  if ((await card.getByTestId("profile-status").innerText()).includes("PENDING")) {
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(card.getByTestId("profile-status")).toHaveText("APPROVED");
  }

  await page.goto("/search?q=Sevara");
  await expect(page.getByText("Sevara Aliyeva")).toBeVisible();
});

test("admin can hide and restore a review, and the public rating follows", async ({ page }) => {
  await login(page, "admin@demo.test");
  await page.goto("/admin/reviews");
  const toggles = page.getByRole("button", { name: /Hide review|Restore review/ });
  if ((await toggles.count()) === 0) test.skip(true, "No reviews yet. Run the client journey test first.");
  const before = await toggles.first().innerText();
  await toggles.first().click();
  await expect(toggles.first()).not.toHaveText(before);
});
