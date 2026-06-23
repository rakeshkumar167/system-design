import { expect, test } from "@playwright/test";

test("learner can discover and read the pilot tutorial", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /master system design/i }),
  ).toBeVisible();

  await page.getByRole("link", { name: /start url shortener/i }).first().click();
  await expect(
    page.getByRole("heading", { name: /design a url shortener/i }),
  ).toBeVisible();

  // The architecture diagram is reachable and exposes accessible meaning.
  await page.getByText(/redirect service reads cache first/i).scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("img", { name: /url shortener architecture/i }),
  ).toBeVisible();
});

test("knowledge checks reveal an explanation after a choice", async ({ page }) => {
  await page.goto("/learn/url-shortener");
  const option = page.getByRole("button", { name: /single-flight/i }).first();
  await option.scrollIntoViewIfNeeded();
  await option.click();
  await expect(page.getByText(/single-flight collapses/i)).toBeVisible();
});

test("curriculum separates available and upcoming content", async ({ page }) => {
  await page.goto("/curriculum");
  await expect(page.getByText(/^coming soon$/i)).toHaveCount(22);

  await page.getByLabel(/search problems/i).fill("payment");
  await expect(
    page.getByRole("heading", { name: "Payment System" }),
  ).toBeVisible();
  await expect(page.getByText(/showing 1 of 25/i)).toBeVisible();
});

test("learner can open the pastebin tutorial", async ({ page }) => {
  await page.goto("/learn/pastebin");
  await expect(
    page.getByRole("heading", { name: /design a pastebin/i }),
  ).toBeVisible();
  // Navigate to the section via URL fragment (TOC is hidden on mobile viewports)
  await page.goto("/learn/pastebin#expiry-and-ttl");
  await expect(page.locator("#expiry-and-ttl")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /pastebin architecture/i }).first(),
  ).toBeVisible();
});

test("theme toggle switches between light and dark", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  const initiallyDark = await html.evaluate((el) => el.classList.contains("dark"));
  await page.getByRole("button", { name: /toggle color theme/i }).click();
  await expect
    .poll(() => html.evaluate((el) => el.classList.contains("dark")))
    .toBe(!initiallyDark);
});
