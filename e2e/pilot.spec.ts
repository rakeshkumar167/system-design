import { expect, test } from "@playwright/test";

test("learner can discover and read the pilot tutorial", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /learn system design/i }),
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
  await expect(page.getByText(/^coming soon$/i)).toHaveCount(19);

  await page.getByLabel(/search problems/i).fill("payment");
  await expect(
    page.getByRole("heading", { name: "Payment System" }),
  ).toBeVisible();
  await expect(page.getByText(/showing 1 of 33/i)).toBeVisible();
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

test("learner can open the notification service tutorial", async ({ page }) => {
  await page.goto("/learn/notification-service");
  await expect(
    page.getByRole("heading", { name: /design a notification service/i }),
  ).toBeVisible();
  await page.goto("/learn/notification-service#delivery-guarantees");
  await expect(page.locator("#delivery-guarantees")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /notification architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the ticket booking tutorial", async ({ page }) => {
  await page.goto("/learn/ticket-booking");
  await expect(
    page.getByRole("heading", { name: /design a ticket booking system/i }),
  ).toBeVisible();
  await page.goto("/learn/ticket-booking#concurrency-control");
  await expect(page.locator("#concurrency-control")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /ticket booking architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the video streaming tutorial", async ({ page }) => {
  await page.goto("/learn/video-streaming");
  await expect(
    page.getByRole("heading", { name: /design a video streaming platform/i }),
  ).toBeVisible();
  await page.goto("/learn/video-streaming#transcoding-pipeline");
  await expect(page.locator("#transcoding-pipeline")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /video streaming architecture/i }).first(),
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

test("learner can open the collaborative doc editor tutorial", async ({ page }) => {
  await page.goto("/learn/collaborative-doc-editor");
  await expect(
    page.getByRole("heading", { name: /design a collaborative document editor/i }),
  ).toBeVisible();
  await page.goto("/learn/collaborative-doc-editor#crdts");
  await expect(page.locator("#crdts")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /collaborative (document )?editor architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the distributed cache tutorial", async ({ page }) => {
  await page.goto("/learn/distributed-cache");
  await expect(
    page.getByRole("heading", { name: /design a distributed cache/i }),
  ).toBeVisible();
  await page.goto("/learn/distributed-cache#consistent-hashing");
  await expect(page.locator("#consistent-hashing")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /distributed cache architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the cloud drive tutorial", async ({ page }) => {
  await page.goto("/learn/cloud-drive");
  await expect(
    page.getByRole("heading", { name: /design a cloud drive/i }),
  ).toBeVisible();
  await page.goto("/learn/cloud-drive#delta-sync");
  await expect(page.locator("#delta-sync")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /cloud drive architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the payment system tutorial", async ({ page }) => {
  await page.goto("/learn/payment-system");
  await expect(
    page.getByRole("heading", { name: /design a payment system/i }),
  ).toBeVisible();
  await page.goto("/learn/payment-system#double-entry-ledger");
  await expect(page.locator("#double-entry-ledger")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /payment system architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the distributed logging tutorial", async ({ page }) => {
  await page.goto("/learn/distributed-logging");
  await expect(
    page.getByRole("heading", { name: /design a distributed logging platform/i }),
  ).toBeVisible();
  await page.goto("/learn/distributed-logging#indexing");
  await expect(page.locator("#indexing")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /distributed logging architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the distributed job scheduler tutorial", async ({ page }) => {
  await page.goto("/learn/distributed-job-scheduler");
  await expect(
    page.getByRole("heading", { name: /design a distributed job scheduler/i }),
  ).toBeVisible();
  await page.goto("/learn/distributed-job-scheduler#leasing-coordination");
  await expect(page.locator("#leasing-coordination")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /job scheduler architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the maps and navigation tutorial", async ({ page }) => {
  await page.goto("/learn/maps-navigation");
  await expect(
    page.getByRole("heading", { name: /design maps and navigation/i }),
  ).toBeVisible();
  await page.goto("/learn/maps-navigation#precomputation");
  await expect(page.locator("#precomputation")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /maps (and )?navigation architecture/i }).first(),
  ).toBeVisible();
});

test("learner can open the api gateway tutorial", async ({ page }) => {
  await page.goto("/learn/api-gateway");
  await expect(
    page.getByRole("heading", { name: /design an api gateway/i }),
  ).toBeVisible();
  await page.goto("/learn/api-gateway#control-data-plane");
  await expect(page.locator("#control-data-plane")).toBeInViewport();
  await expect(
    page.getByRole("img", { name: /api gateway architecture/i }).first(),
  ).toBeVisible();
});
