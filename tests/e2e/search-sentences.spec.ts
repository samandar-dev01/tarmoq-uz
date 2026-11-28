import { test, expect, type Page } from "@playwright/test";
import { settled } from "./helpers";

// A sentence typed into the search finds what it asks for, although no package holds those words in that order
// (src/lib/searchWords.ts). Only the demo creators' packages are relied on: other specs add their own beside them.

const CLOSE = "Aynan mos xizmat topilmadi. Yaqin natijalarni koʻrsatyapmiz.";
const field = (page: Page) => page.getByRole("combobox", { name: "Sizga nima kerak?" });
const button = (page: Page) => page.getByRole("button", { name: "Qidirish", exact: true });

async function searchFromHome(page: Page, words: string) {
  await page.goto("/");
  await settled(page);
  await field(page).fill(words);
  await button(page).click();
  await expect(page).toHaveURL(/\/search\?q=/);
}

test("the home page's example sentences find the packages they ask for", async ({ page }) => {
  await searchFromHome(page, "Kafem uchun kreativ video…");
  await expect(page.getByText("Kafe va restoran paketi")).toBeVisible();

  await searchFromHome(page, "Instagram uchun professional reel…");
  await expect(page.getByText("Instagram Reel (60 soniyagacha)")).toBeVisible();
});

test("when nothing answers all of a sentence, close results are shown and said to be close", async ({ page }) => {
  // No package can hold the made-up word, so only the wedding part can be answered.
  await searchFromHome(page, "toʻyimiz uchun zzqxw");
  await expect(page.getByText(CLOSE)).toBeVisible();
  await expect(page.getByText("Toʻy: kun boʻyi mobil suratga olish")).toBeVisible();
});

test("words that ask for nothing known find nothing, and the chosen city always holds", async ({ page }) => {
  await page.goto("/search?q=zzqxw+vvkkp");
  await expect(page.getByRole("heading", { name: "Bu filtrlarga mos ijodkor topilmadi" })).toBeVisible();
  await expect(page.getByText(CLOSE)).toHaveCount(0);

  // Madina works in Andijon: her café package is not offered to someone who chose another city.
  await page.goto("/search?q=" + encodeURIComponent("Kafem uchun kreativ video") + "&city=Termiz");
  await expect(page.getByText("Kafe va restoran paketi")).toHaveCount(0);
});

test("on a wide screen the suggestions leave the city and the search button free", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await settled(page);
  await field(page).click();
  await field(page).pressSequentially("Jasur");
  await expect(page.getByRole("option").first()).toBeVisible();
  for (const control of [button(page), page.getByRole("combobox", { name: "Shahar" })]) {
    const box = (await control.boundingBox())!;
    const covered = await page.evaluate(([x, y]) => !!document.elementFromPoint(x!, y!)?.closest('[role="listbox"]'), [box.x + box.width / 2, box.y + box.height / 2]);
    expect(covered).toBe(false);
  }
  await button(page).click();
  await expect(page).toHaveURL(/\/search\?q=Jasur/);
});
